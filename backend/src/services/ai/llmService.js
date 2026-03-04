/**
 * LLM Service - OpenAI GPT-4o Integration
 *
 * Provides AI capabilities for:
 * - Natural language log summarization
 * - Chat assistant responses
 * - Activity summaries
 * - Insight generation
 */

import { supabase } from '../supabase.js';
import crypto from 'crypto';

// OpenAI configuration from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
const OPENAI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;

// Cache configuration
const CACHE_TTL_SECONDS = parseInt(process.env.AI_CACHE_TTL_SECONDS) || 3600; // 1 hour default
const SUMMARY_CACHE_TTL_SECONDS = parseInt(process.env.AI_SUMMARY_CACHE_TTL_SECONDS) || 86400; // 24 hours

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Track API key errors to avoid spamming logs with the same 401 error
let _apiKeyErrorLogged = false;

/**
 * Check if OpenAI is configured
 */
export const isConfigured = () => {
  return !!OPENAI_API_KEY;
};

/**
 * Generate a hash for cache key
 */
const generateCacheKey = (prefix, input) => {
  const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex').substring(0, 16);
  return `${prefix}_${hash}`;
};

/**
 * Get cached response if available
 */
const getCachedResponse = async (cacheKey) => {
  console.log('💾 LLM: Checking cache for key:', cacheKey);
  try {
    const { data, error } = await supabase
      .from('llm_cache')
      .select('response, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      console.log('❌ LLM: Cache miss - no cached response found');
      return null;
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.log('⏰ LLM: Cache expired, cleaning up...');
      await supabase.from('llm_cache').delete().eq('cache_key', cacheKey);
      return null;
    }

    console.log('✅ LLM: Cache hit! Returning cached response');

    // Update hit count using RPC call for increment
    await supabase.rpc('increment_cache_hit_count', { p_cache_key: cacheKey })
      .catch(async () => {
        // Fallback: fetch current value and update
        const { data: current } = await supabase
          .from('llm_cache')
          .select('hit_count')
          .eq('cache_key', cacheKey)
          .single();

        if (current) {
          await supabase
            .from('llm_cache')
            .update({
              hit_count: (current.hit_count || 0) + 1,
              last_hit_at: new Date().toISOString()
            })
            .eq('cache_key', cacheKey);
        }
      });

    return data.response;
  } catch (error) {
    console.error('❌ LLM: Cache lookup error:', error);
    return null;
  }
};

/**
 * Store response in cache
 */
const cacheResponse = async (cacheKey, prompt, response, ttlSeconds = CACHE_TTL_SECONDS, tokensUsed = 0) => {
  console.log('💾 LLM: Caching response...', {
    cache_key: cacheKey,
    ttl_seconds: ttlSeconds,
    tokens_used: tokensUsed
  });
  try {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

    await supabase.from('llm_cache').upsert({
      cache_key: cacheKey,
      prompt_hash: promptHash,
      prompt_preview: prompt.substring(0, 500),
      response,
      model: OPENAI_MODEL,
      tokens_used: tokensUsed,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      hit_count: 0
    });

    console.log('✅ LLM: Response cached successfully');
  } catch (error) {
    console.error('❌ LLM: Cache store error:', error);
  }
};

/**
 * Call OpenAI API
 */
const callOpenAI = async (messages, options = {}) => {
  console.log('🧠 LLM: Checking OpenAI configuration...');
  if (!isConfigured()) {
    console.error('❌ LLM: OpenAI API key not configured');
    throw new Error('OpenAI API key not configured');
  }

  const {
    maxTokens = OPENAI_MAX_TOKENS,
    temperature = OPENAI_TEMPERATURE,
    model = OPENAI_MODEL
  } = options;

  console.log('🚀 LLM: Calling OpenAI API...', {
    model,
    maxTokens,
    temperature,
    message_count: messages.length
  });

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || 'Unknown error';

      // Suppress repeated 401 errors to avoid log spam
      if (response.status === 401) {
        if (!_apiKeyErrorLogged) {
          _apiKeyErrorLogged = true;
          console.error('❌ LLM: OpenAI API key is invalid or expired. AI insight descriptions will use fallback text. Fix the OPENAI_API_KEY env var to restore LLM features.');
        }
      } else {
        console.error('❌ LLM: OpenAI API error', { status: response.status, error: errorMsg });
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errorMsg}`);
    }

    const data = await response.json();
    console.log('✅ LLM: OpenAI API response received', {
      tokens_used: data.usage?.total_tokens,
      finish_reason: data.choices?.[0]?.finish_reason
    });

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens || 0,
      finishReason: data.choices[0]?.finish_reason
    };
  } catch (error) {
    console.error('[LLMService] OpenAI API call failed:', error);
    throw error;
  }
};

/**
 * Convert a single activity log event to natural language
 */
export const summarizeEvent = async (event) => {
  const cacheKey = generateCacheKey('event', { event_id: event.id, action: event.action });

  // Check cache first
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a smart lock activity summarizer. Convert raw lock events into friendly, human-readable sentences.
Keep responses concise (1 sentence). Include relevant details like time, user, and access method.
Use natural language like "unlocked the front door" instead of "performed unlock action".`;

  const userPrompt = `Convert this lock event to a natural language summary:
Action: ${event.action}
User: ${event.user_name || 'Unknown user'}
Access Method: ${event.access_method || 'Unknown'}
Time: ${new Date(event.created_at).toLocaleString()}
Success: ${event.success !== false ? 'Yes' : 'No'}
${event.failure_reason ? `Failure Reason: ${event.failure_reason}` : ''}
${event.metadata ? `Additional Info: ${JSON.stringify(event.metadata)}` : ''}`;

  try {
    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 100, temperature: 0.5 });

    // Cache the result
    await cacheResponse(cacheKey, userPrompt, result.content, CACHE_TTL_SECONDS, result.tokensUsed);

    return result.content;
  } catch (error) {
    console.error('[LLMService] Event summarization failed:', error);
    // Return a fallback summary
    return `${event.user_name || 'Someone'} ${event.action} the door using ${event.access_method || 'unknown method'}`;
  }
};

/**
 * Generate a daily activity summary
 */
export const generateDailySummary = async (lockId, lockName, events, date) => {
  const cacheKey = generateCacheKey('daily_summary', { lock_id: lockId, date });

  // Check cache first
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  if (!events || events.length === 0) {
    return `No activity recorded for ${lockName} on ${date}.`;
  }

  // Prepare event summary
  const eventCounts = {};
  const uniqueUsers = new Set();
  let failedAttempts = 0;

  events.forEach(event => {
    eventCounts[event.action] = (eventCounts[event.action] || 0) + 1;
    if (event.user_id) uniqueUsers.add(event.user_id);
    if (event.action === 'failed_attempt') failedAttempts++;
  });

  const systemPrompt = `You are a smart lock activity analyst. Create a brief, informative daily summary of lock activity.
Keep it to 2-3 sentences. Highlight any unusual patterns or security concerns. Be conversational but professional.`;

  const userPrompt = `Create a daily summary for "${lockName}" on ${date}:

Total Events: ${events.length}
Event Breakdown: ${JSON.stringify(eventCounts)}
Unique Users: ${uniqueUsers.size}
Failed Attempts: ${failedAttempts}

Sample events (first 10):
${events.slice(0, 10).map(e => `- ${e.action} by ${e.user_name || 'Unknown'} at ${new Date(e.created_at).toLocaleTimeString()}`).join('\n')}`;

  try {
    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 200, temperature: 0.6 });

    // Cache with longer TTL for daily summaries
    await cacheResponse(cacheKey, userPrompt, result.content, SUMMARY_CACHE_TTL_SECONDS, result.tokensUsed);

    return result.content;
  } catch (error) {
    console.error('[LLMService] Daily summary generation failed:', error);
    // Return a basic fallback summary
    return `${lockName} had ${events.length} events on ${date}, including ${eventCounts['unlocked'] || 0} unlocks and ${eventCounts['locked'] || 0} locks by ${uniqueUsers.size} users.`;
  }
};

/**
 * Answer a question about lock activity (chat assistant)
 */
export const answerQuestion = async (question, lockData, conversationHistory = []) => {
  if (!isConfigured()) {
    return {
      answer: "I'm sorry, but AI features are not currently available. Please contact your administrator.",
      suggestions: []
    };
  }

  const systemPrompt = `You are AwayKey AI, a helpful smart lock assistant. You can answer questions about lock activity, status, and users.
You CANNOT perform actions like unlocking doors or changing settings - only provide information.
Be concise, friendly, and security-conscious. If asked about something you can't do, politely explain your limitations.
When discussing security events, be informative but not alarmist.

Lock Information:
- Name: ${lockData.name}
- Location: ${lockData.location}
- Current Status: ${lockData.is_locked ? 'Locked' : 'Unlocked'}
- Battery Level: ${lockData.battery_level}%
- Online: ${lockData.is_online ? 'Yes' : 'No'}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: question }
  ];

  try {
    const result = await callOpenAI(messages, {
      maxTokens: 300,
      temperature: 0.7
    });

    // Generate follow-up suggestions
    const suggestions = await generateFollowUpSuggestions(question, result.content);

    return {
      answer: result.content,
      suggestions,
      tokensUsed: result.tokensUsed
    };
  } catch (error) {
    console.error('[LLMService] Chat answer failed:', error);
    return {
      answer: "I'm having trouble processing your question right now. Please try again in a moment.",
      suggestions: ['Try asking again', 'Check lock status', 'View recent activity']
    };
  }
};

/**
 * Generate follow-up question suggestions
 */
const generateFollowUpSuggestions = async (question, answer) => {
  // Simple rule-based suggestions (can be enhanced with LLM)
  const suggestions = [];

  if (question.toLowerCase().includes('who') || question.toLowerCase().includes('access')) {
    suggestions.push('Show me today\'s activity');
    suggestions.push('Any failed attempts recently?');
  } else if (question.toLowerCase().includes('battery')) {
    suggestions.push('How long will the battery last?');
    suggestions.push('When was it last changed?');
  } else if (question.toLowerCase().includes('lock') || question.toLowerCase().includes('unlock')) {
    suggestions.push('Who unlocked it last?');
    suggestions.push('Show unusual activity');
  } else {
    suggestions.push('Show recent activity');
    suggestions.push('Any security alerts?');
    suggestions.push('Check battery status');
  }

  return suggestions.slice(0, 3);
};

/**
 * Generate an insight description from anomaly data
 */
export const generateInsightDescription = async (insightType, data) => {
  const systemPrompt = `You are a security analyst for smart locks. Generate a brief, clear description of the security insight.
Keep it to 1-2 sentences. Be informative but not alarmist. Include actionable advice if appropriate.`;

  let userPrompt;

  switch (insightType) {
    case 'unusual_hour':
      userPrompt = `Access detected at unusual hour:
User: ${data.userName}
Time: ${data.time}
Typical hours for this user: ${data.typicalHours}`;
      break;

    case 'failed_attempts':
      userPrompt = `Multiple failed access attempts detected:
Count: ${data.count} attempts
Time window: ${data.timeWindow}
Access method: ${data.accessMethod}`;
      break;

    case 'new_user':
      userPrompt = `First-time access by user:
User: ${data.userName}
Time: ${data.time}
Access method: ${data.accessMethod}`;
      break;

    case 'rapid_cycling':
      userPrompt = `Rapid lock/unlock cycling detected:
Count: ${data.count} times
Duration: ${data.duration}
User: ${data.userName}`;
      break;

    default:
      userPrompt = `Security insight: ${JSON.stringify(data)}`;
  }

  try {
    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 100, temperature: 0.5 });

    return result.content;
  } catch (error) {
    // Don't re-log 401 errors (already logged once in callOpenAI)
    if (!error.message?.includes('401')) {
      console.error('[LLMService] Insight generation failed:', error.message);
    }
    return `${insightType.replace(/_/g, ' ')} detected. Please review.`;
  }
};

/**
 * Batch summarize multiple events (for efficiency)
 */
export const batchSummarizeEvents = async (events) => {
  if (!events || events.length === 0) return [];

  // For small batches, summarize individually
  if (events.length <= 3) {
    const summaries = await Promise.all(events.map(e => summarizeEvent(e)));
    return events.map((event, i) => ({ ...event, natural_language_summary: summaries[i] }));
  }

  // For larger batches, use a single API call
  const systemPrompt = `You are a smart lock activity summarizer. Convert each event to a natural language summary.
Return a JSON array of summaries in the same order as the input events.
Each summary should be a single, concise sentence.`;

  const eventsList = events.map((e, i) => `${i + 1}. ${e.action} by ${e.user_name || 'Unknown'} using ${e.access_method || 'unknown'} at ${new Date(e.created_at).toLocaleTimeString()}`).join('\n');

  const userPrompt = `Summarize these ${events.length} lock events:
${eventsList}

Return as JSON array: ["summary1", "summary2", ...]`;

  try {
    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: events.length * 50, temperature: 0.5 });

    // Parse JSON response
    const summaries = JSON.parse(result.content);

    return events.map((event, i) => ({
      ...event,
      natural_language_summary: summaries[i] || `${event.user_name || 'Someone'} ${event.action} the door`
    }));
  } catch (error) {
    console.error('[LLMService] Batch summarization failed:', error);
    // Fallback to basic summaries
    return events.map(event => ({
      ...event,
      natural_language_summary: `${event.user_name || 'Someone'} ${event.action} the door using ${event.access_method || 'unknown method'}`
    }));
  }
};

export default {
  isConfigured,
  summarizeEvent,
  generateDailySummary,
  answerQuestion,
  generateInsightDescription,
  batchSummarizeEvents
};
