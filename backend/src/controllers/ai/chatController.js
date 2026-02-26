/**
 * AI Chat Controller
 *
 * Handles the conversational AI assistant for querying lock data
 */

import { supabase } from '../../services/supabase.js';
import llmService from '../../services/ai/llmService.js';
import logger from '../../utils/logger.js';
import { parsePagination } from '../../utils/pagination.js';

/**
 * Send a chat message and get AI response
 * POST /api/ai/chat
 */
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, lockId, conversationId } = req.body;
    logger.info(`[AI CHAT] 💬 User ${userId} sending message to lock ${lockId}`, { messagePreview: message?.substring(0, 50), conversationId });

    if (!message || !lockId) {
      logger.warn('[AI] ⚠️ Chat message validation failed - missing message or lockId');
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Message and lockId are required'
        }
      });
    }

    // Check if LLM service is configured
    if (!llmService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI chat service is not configured. Please set up OPENAI_API_KEY.'
        }
      });
    }

    // Verify user has access to the lock
    const { data: userLock } = await supabase
      .from('user_locks')
      .select('can_view_logs')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (!userLock) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this lock'
        }
      });
    }

    // Get lock details
    const { data: lock } = await supabase
      .from('locks')
      .select('id, name, location, is_locked, is_online, battery_level')
      .eq('id', lockId)
      .single();

    if (!lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Check if chat_conversations table exists by trying to query it
    let conversation = null;
    let conversationSupported = true;

    if (conversationId) {
      const { data: existingConv, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError && (convError.code === '42P01' || convError.message?.includes('relation'))) {
        // Table doesn't exist
        conversationSupported = false;
      } else {
        conversation = existingConv;
      }
    }

    if (!conversation && conversationSupported) {
      // Try to create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('chat_conversations')
        .insert([{
          user_id: userId,
          lock_id: lockId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
          message_count: 0,
          total_tokens: 0
        }])
        .select()
        .single();

      if (createError) {
        if (createError.code === '42P01' || createError.message?.includes('relation')) {
          conversationSupported = false;
        } else {
          console.error('Failed to create conversation:', createError);
          // Continue without conversation storage
          conversationSupported = false;
        }
      } else {
        conversation = newConv;
      }
    }

    // Parse existing messages (if conversation exists)
    const existingMessages = conversation && Array.isArray(conversation.messages) ? conversation.messages : [];

    // Gather context data for the AI
    const lockContext = await gatherLockContext(lockId, userId);

    // Build enhanced lock data for LLM
    const enhancedLockData = {
      ...lock,
      ...lockContext
    };

    // Convert messages to OpenAI format
    const conversationHistory = existingMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Get AI response
    const aiResponse = await llmService.answerQuestion(
      message,
      enhancedLockData,
      conversationHistory
    );

    // Update conversation with new messages (if conversation storage is supported)
    if (conversation && conversationSupported) {
      const updatedMessages = [
        ...existingMessages,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: aiResponse.answer, timestamp: new Date().toISOString() }
      ];

      const { error: updateError } = await supabase
        .from('chat_conversations')
        .update({
          messages: updatedMessages,
          message_count: updatedMessages.length,
          total_tokens: (conversation.total_tokens || 0) + (aiResponse.tokensUsed || 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error('Failed to update conversation:', updateError);
      }
    }

    logger.info(`[AI CHAT] ✅ Response generated for user ${userId}`, { lockId, conversationId: conversation?.id, tokensUsed: aiResponse.tokensUsed, messagePreview: message?.substring(0, 50) });
    res.json({
      success: true,
      data: {
        response: aiResponse.answer,
        suggestions: aiResponse.suggestions,
        conversationId: conversation?.id || null
      }
    });
  } catch (error) {
    logger.error('[AI] ❌ Chat send message error:', { error: error.message, userId: req.user?.id, lockId: req.body?.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to process message'
      }
    });
  }
};

/**
 * Get conversation history
 * GET /api/ai/chat/conversations
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockId } = req.query;
    const { limit } = parsePagination(req.query, { limit: 20 });
    // logger.ai.request('getConversations', userId, { lockId, limit });

    let query = supabase
      .from('chat_conversations')
      .select(`
        id,
        lock_id,
        title,
        message_count,
        created_at,
        updated_at,
        locks (name)
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (lockId) {
      query = query.eq('lock_id', lockId);
    }

    const { data: conversations, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch conversations' }
      });
    }

    logger.info(`[AI] ✅ Retrieved ${conversations.length} conversations for user ${userId}`);
    res.json({
      success: true,
      data: conversations.map(c => ({
        ...c,
        lock_name: c.locks?.name
      }))
    });
  } catch (error) {
    logger.error('[AI] ❌ Get conversations error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch conversations' }
    });
  }
};

/**
 * Get a specific conversation with messages
 * GET /api/ai/chat/conversations/:conversationId
 */
export const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    // logger.ai.request('getConversation', userId, { conversationId });

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        locks (name, location)
      `)
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (error || !conversation) {
      logger.warn('[AI] ⚠️ Conversation not found:', { conversationId, userId });
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    logger.info(`[AI] ✅ Retrieved conversation ${conversationId} (${conversation.message_count || 0} messages)`);
    res.json({
      success: true,
      data: {
        ...conversation,
        lock_name: conversation.locks?.name,
        lock_location: conversation.locks?.location
      }
    });
  } catch (error) {
    logger.error('[AI] ❌ Get conversation error:', { error: error.message, conversationId: req.params.conversationId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch conversation' }
    });
  }
};

/**
 * Archive a conversation
 * DELETE /api/ai/chat/conversations/:conversationId
 */
export const archiveConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    // logger.ai.request('archiveConversation', userId, { conversationId });

    const { error } = await supabase
      .from('chat_conversations')
      .update({ is_archived: true })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[AI] ❌ Failed to archive conversation:', { error: error.message, conversationId });
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to archive conversation' }
      });
    }

    logger.info(`[AI] ✅ Conversation ${conversationId} archived by user ${userId}`);
    res.json({
      success: true,
      message: 'Conversation archived'
    });
  } catch (error) {
    logger.error('[AI] ❌ Archive conversation error:', { error: error.message, conversationId: req.params.conversationId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to archive conversation' }
    });
  }
};

/**
 * Get suggested questions for a lock
 * GET /api/ai/chat/suggestions/:lockId
 */
export const getSuggestions = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    // logger.ai.request('getSuggestions', userId, { lockId });

    // Get lock info
    const { data: lock } = await supabase
      .from('locks')
      .select('name, battery_level')
      .eq('id', lockId)
      .single();

    // Generate contextual suggestions
    const suggestions = [
      `Who accessed ${lock?.name || 'the lock'} today?`,
      'Were there any failed attempts recently?',
      'Show me unusual activity',
      `How's the battery doing?`,
      'When was the last unlock?'
    ];

    // Add battery-specific suggestion if low
    if (lock && lock.battery_level < 30) {
      suggestions.unshift(`Why is the battery at ${lock.battery_level}%?`);
    }

    logger.info(`[AI] ✅ Generated ${suggestions.slice(0, 5).length} suggestions for lock ${lockId}`);
    res.json({
      success: true,
      data: { suggestions: suggestions.slice(0, 5) }
    });
  } catch (error) {
    logger.error('[AI] ❌ Get suggestions error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get suggestions' }
    });
  }
};

// Helper Functions

/**
 * Gather context data about a lock for the AI
 */
async function gatherLockContext(lockId, userId) {
  const context = {
    recent_activity: [],
    users_with_access: 0,
    failed_attempts_24h: 0,
    last_unlock: null
  };

  try {
    // Get recent activity (last 10 events)
    const { data: recentActivity } = await supabase
      .from('activity_logs')
      .select(`
        action,
        access_method,
        created_at,
        user:user_id (first_name, last_name)
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentActivity) {
      context.recent_activity = recentActivity.map(a => ({
        action: a.action,
        method: a.access_method,
        time: a.created_at,
        user: a.user ? `${a.user.first_name} ${a.user.last_name}` : 'Unknown'
      }));

      // Find last unlock
      const lastUnlock = recentActivity.find(a => a.action === 'unlocked');
      if (lastUnlock) {
        context.last_unlock = {
          time: lastUnlock.created_at,
          user: lastUnlock.user ? `${lastUnlock.user.first_name} ${lastUnlock.user.last_name}` : 'Unknown'
        };
      }
    }

    // Count users with access
    const { count: userCount } = await supabase
      .from('user_locks')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('is_active', true);

    context.users_with_access = userCount || 0;

    // Count failed attempts in last 24h
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { count: failedCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('action', 'failed_attempt')
      .gte('created_at', yesterday.toISOString());

    context.failed_attempts_24h = failedCount || 0;
  } catch (error) {
    console.error('Error gathering lock context:', error);
  }

  return context;
}

export default {
  sendMessage,
  getConversations,
  getConversation,
  archiveConversation,
  getSuggestions
};
