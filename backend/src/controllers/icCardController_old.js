/**
 * IC Card Controller
 * Manages IC card (RFID/NFC) access methods with TTLock API integration and database storage
 */

import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Get TTLock access token for the current user
 */
async function getTTLockAccessToken(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('ttlock_access_token, ttlock_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Failed to get TTLock access token');
  }

  // Check if token is expired
  const expiresAt = new Date(data.ttlock_token_expires_at);
  if (expiresAt < new Date()) {
    throw new Error('TTLock access token expired. Please reconnect your TTLock account.');
  }

  return data.ttlock_access_token;
}

/**
 * List all IC cards for a lock
 * GET /locks/:lockId/cards
 */
export const listICCards = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { pageNo = 1, pageSize = 20, sync = false } = req.query;

    logger.info(`[IC_CARD] Listing IC cards for lock ${lockId}`);

    // Check user has access to this lock
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('ttlock_lock_id')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // If sync=true, fetch from TTLock cloud and update database
    if (sync === 'true' && lock.ttlock_lock_id) {
      try {
        const accessToken = await getTTLockAccessToken(userId);

        const params = {
          clientId: TTLOCK_CLIENT_ID,
          accessToken,
          lockId: lock.ttlock_lock_id,
          pageNo: parseInt(pageNo),
          pageSize: parseInt(pageSize),
          date: Date.now()
        };

        const response = await axios.post(
          `${TTLOCK_API_BASE_URL}/v3/identityCard/list`,
          null,
          { params }
        );

        if (response.data && response.data.list) {
          // Sync cards to database
          for (const card of response.data.list) {
            await supabase
              .from('ic_cards')
              .upsert({
                lock_id: lockId,
                user_id: userId,
                ttlock_card_id: card.cardId,
                card_number: card.cardNumber,
                card_name: card.cardName,
                start_date: card.startDate ? new Date(card.startDate).toISOString() : null,
                end_date: card.endDate ? new Date(card.endDate).toISOString() : null,
                status: card.status,
                sender_username: card.senderUsername
              }, {
                onConflict: 'ttlock_card_id'
              });
          }

          logger.info(`[IC_CARD] Synced ${response.data.list.length} cards from cloud`);
        }
      } catch (syncError) {
        logger.warn('[IC_CARD] Cloud sync failed:', syncError.message);
        // Continue to return database records even if sync fails
      }
    }

    // Fetch from database
    const { data: cards, error } = await supabase
      .from('ic_cards_with_user_info')
      .select('*')
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[IC_CARD] Database query failed:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch IC cards'
        }
      });
    }

    logger.info(`[IC_CARD] ✅ Retrieved ${cards.length} cards for lock ${lockId}`);

    res.json({
      success: true,
      data: cards
    });

  } catch (error) {
    logger.error('[IC_CARD] List error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to list IC cards'
      }
    });
  }
};

/**
 * Add a new IC card to a lock
 * POST /locks/:lockId/cards
 */
export const addICCard = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      cardNumber,
      cardName,
      startDate,
      endDate,
      addType = 2 // 1=Bluetooth, 2=Gateway (default)
    } = req.body;

    logger.info(`[IC_CARD] Adding IC card to lock ${lockId}`);

    // Validate required fields
    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CARD_NUMBER',
          message: 'Card number is required (read from NFC chip)'
        }
      });
    }

    // Get lock details
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('ttlock_lock_id')
      .eq('id', lockId)
      .single();

    if (lockError || !lock || !lock.ttlock_lock_id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_NOT_FOUND',
          message: 'Lock not found or not connected to TTLock cloud'
        }
      });
    }

    // Get TTLock access token
    const accessToken = await getTTLockAccessToken(userId);

    // Prepare TTLock API params
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: lock.ttlock_lock_id,
      cardNumber,
      addType,
      date: Date.now()
    };

    if (cardName) params.cardName = cardName;
    if (startDate) params.startDate = new Date(startDate).getTime();
    if (endDate) params.endDate = new Date(endDate).getTime();

    logger.info('[IC_CARD] Calling TTLock API to add card...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/addForReversedCardNumber`,
      null,
      { params }
    );

    if (!response.data || !response.data.cardId) {
      throw new Error('TTLock API did not return card ID');
    }

    const ttlockCardId = response.data.cardId;

    logger.info(`[IC_CARD] ✅ IC card added to TTLock cloud: ID ${ttlockCardId}`);

    // Store in our database
    const { data: card, error: dbError } = await supabase
      .from('ic_cards')
      .insert({
        lock_id: lockId,
        user_id: userId,
        ttlock_card_id: ttlockCardId,
        card_number: cardNumber,
        card_name: cardName || 'Unnamed Card',
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        status: 1 // Normal
      })
      .select()
      .single();

    if (dbError) {
      logger.error('[IC_CARD] Database insert failed:', dbError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Card added to lock but failed to save to database'
        }
      });
    }

    logger.info(`[IC_CARD] ✅ IC card saved to database: ${card.id}`);

    res.status(201).json({
      success: true,
      data: card,
      message: 'IC card added successfully'
    });

  } catch (error) {
    logger.error('[IC_CARD] Add error:', error);

    // Parse TTLock API errors
    if (error.response && error.response.data) {
      const apiError = error.response.data;
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to add IC card'
      }
    });
  }
};

/**
 * Delete an IC card from a lock
 * DELETE /locks/:lockId/cards/:cardId
 */
export const deleteICCard = async (req, res) => {
  try {
    const { lockId, cardId } = req.params;
    const userId = req.user.id;
    const { deleteType = 2 } = req.body; // 1=Bluetooth, 2=Gateway (default)

    logger.info(`[IC_CARD] Deleting IC card ${cardId} from lock ${lockId}`);

    // Get card from database
    const { data: card, error: cardError } = await supabase
      .from('ic_cards')
      .select('*, locks(ttlock_lock_id)')
      .eq('id', cardId)
      .eq('lock_id', lockId)
      .single();

    if (cardError || !card) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CARD_NOT_FOUND',
          message: 'IC card not found'
        }
      });
    }

    if (!card.locks || !card.locks.ttlock_lock_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LOCK_NOT_CONNECTED',
          message: 'Lock not connected to TTLock cloud'
        }
      });
    }

    // Get TTLock access token
    const accessToken = await getTTLockAccessToken(userId);

    // Call TTLock API to delete
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: card.locks.ttlock_lock_id,
      cardId: card.ttlock_card_id,
      deleteType,
      date: Date.now()
    };

    logger.info('[IC_CARD] Calling TTLock API to delete card...');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/delete`,
      null,
      { params }
    );

    logger.info('[IC_CARD] ✅ IC card deleted from TTLock cloud');

    // Delete from our database
    const { error: deleteError } = await supabase
      .from('ic_cards')
      .delete()
      .eq('id', cardId);

    if (deleteError) {
      logger.error('[IC_CARD] Database delete failed:', deleteError);
    } else {
      logger.info('[IC_CARD] ✅ IC card deleted from database');
    }

    res.json({
      success: true,
      message: 'IC card deleted successfully'
    });

  } catch (error) {
    logger.error('[IC_CARD] Delete error:', error);

    if (error.response && error.response.data) {
      const apiError = error.response.data;
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to delete IC card'
      }
    });
  }
};

/**
 * Update IC card validity period
 * PATCH /locks/:lockId/cards/:cardId
 */
export const updateICCardPeriod = async (req, res) => {
  try {
    const { lockId, cardId } = req.params;
    const userId = req.user.id;
    const { startDate, endDate, changeType = 2 } = req.body;

    logger.info(`[IC_CARD] Updating period for card ${cardId}`);

    // Get card from database
    const { data: card, error: cardError } = await supabase
      .from('ic_cards')
      .select('*, locks(ttlock_lock_id)')
      .eq('id', cardId)
      .eq('lock_id', lockId)
      .single();

    if (cardError || !card) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CARD_NOT_FOUND',
          message: 'IC card not found'
        }
      });
    }

    // Get TTLock access token
    const accessToken = await getTTLockAccessToken(userId);

    // Prepare params
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: card.locks.ttlock_lock_id,
      cardId: card.ttlock_card_id,
      changeType,
      date: Date.now()
    };

    if (startDate) params.startDate = new Date(startDate).getTime();
    if (endDate) params.endDate = new Date(endDate).getTime();

    logger.info('[IC_CARD] Calling TTLock API to update period...');

    // Call TTLock API
    await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/changePeriod`,
      null,
      { params }
    );

    logger.info('[IC_CARD] ✅ Period updated in TTLock cloud');

    // Update in our database
    const { data: updated, error: updateError } = await supabase
      .from('ic_cards')
      .update({
        start_date: startDate ? new Date(startDate).toISOString() : card.start_date,
        end_date: endDate ? new Date(endDate).toISOString() : card.end_date
      })
      .eq('id', cardId)
      .select()
      .single();

    if (updateError) {
      logger.error('[IC_CARD] Database update failed:', updateError);
    }

    logger.info('[IC_CARD] ✅ Period updated in database');

    res.json({
      success: true,
      data: updated,
      message: 'IC card period updated successfully'
    });

  } catch (error) {
    logger.error('[IC_CARD] Update period error:', error);

    if (error.response && error.response.data) {
      const apiError = error.response.data;
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to update IC card period'
      }
    });
  }
};

export default {
  listICCards,
  addICCard,
  deleteICCard,
  updateICCardPeriod
};
