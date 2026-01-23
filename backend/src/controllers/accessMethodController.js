import { supabase } from '../services/supabase.js';

/**
 * Access Method Controller
 * Handles fingerprints, IC cards, and other biometric access methods
 */

// =====================================================
// FINGERPRINT ENDPOINTS
// =====================================================

/**
 * Get All Fingerprints for a Lock
 * GET /locks/:lockId/fingerprints
 */
export const getFingerprints = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { is_active } = req.query;

    let query = supabase
      .from('fingerprints')
      .select(`
        id,
        fingerprint_number,
        name,
        user_id,
        valid_from,
        valid_until,
        is_active,
        created_at,
        updated_at,
        user:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: fingerprints, error } = await query;

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('relation') || error.code === 'PGRST204') {
        console.log('Fingerprints table not found - returning empty list');
        return res.json({
          success: true,
          data: [],
          message: 'Fingerprints feature not yet configured. Run migration 003_fingerprints_and_cards.sql'
        });
      }
      console.error('Get fingerprints error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch fingerprints'
        }
      });
    }

    res.json({
      success: true,
      data: fingerprints || []
    });
  } catch (error) {
    console.error('Get fingerprints error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch fingerprints'
      }
    });
  }
};

/**
 * Add Fingerprint
 * POST /locks/:lockId/fingerprints
 */
export const addFingerprint = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      fingerprint_number,
      name,
      assigned_user_id,
      valid_from,
      valid_until
    } = req.body;

    console.log('📝 Adding fingerprint:', { lockId, fingerprint_number, name });

    // Check if fingerprint number already exists for this lock
    const { data: existing } = await supabase
      .from('fingerprints')
      .select('id')
      .eq('lock_id', lockId)
      .eq('fingerprint_number', fingerprint_number)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_FINGERPRINT',
          message: 'This fingerprint is already registered'
        }
      });
    }

    const { data: fingerprint, error } = await supabase
      .from('fingerprints')
      .insert([{
        lock_id: lockId,
        fingerprint_number,
        name: name || 'Fingerprint',
        user_id: assigned_user_id || userId,
        valid_from: valid_from ? new Date(valid_from).toISOString() : null,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
        is_active: true,
        created_by: userId
      }])
      .select(`
        id,
        fingerprint_number,
        name,
        user_id,
        valid_from,
        valid_until,
        is_active,
        created_at
      `)
      .single();

    if (error) {
      console.error('Add fingerprint error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to add fingerprint',
          details: error.message
        }
      });
    }

    console.log('✅ Fingerprint added:', fingerprint.id);

    res.status(201).json({
      success: true,
      data: fingerprint
    });
  } catch (error) {
    console.error('Add fingerprint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add fingerprint'
      }
    });
  }
};

/**
 * Update Fingerprint
 * PATCH /locks/:lockId/fingerprints/:fingerprintId
 */
export const updateFingerprint = async (req, res) => {
  try {
    const { fingerprintId } = req.params;
    const {
      name,
      assigned_user_id,
      valid_from,
      valid_until,
      is_active
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (assigned_user_id !== undefined) updates.user_id = assigned_user_id;
    if (valid_from !== undefined) updates.valid_from = new Date(valid_from).toISOString();
    if (valid_until !== undefined) updates.valid_until = new Date(valid_until).toISOString();
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: fingerprint, error } = await supabase
      .from('fingerprints')
      .update(updates)
      .eq('id', fingerprintId)
      .select()
      .single();

    if (error || !fingerprint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Fingerprint not found'
        }
      });
    }

    res.json({
      success: true,
      data: fingerprint
    });
  } catch (error) {
    console.error('Update fingerprint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update fingerprint'
      }
    });
  }
};

/**
 * Delete Fingerprint
 * DELETE /locks/:lockId/fingerprints/:fingerprintId
 */
export const deleteFingerprint = async (req, res) => {
  try {
    const { fingerprintId } = req.params;

    const { error } = await supabase
      .from('fingerprints')
      .delete()
      .eq('id', fingerprintId);

    if (error) {
      console.error('Delete fingerprint error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete fingerprint'
        }
      });
    }

    res.json({
      success: true,
      message: 'Fingerprint deleted successfully'
    });
  } catch (error) {
    console.error('Delete fingerprint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete fingerprint'
      }
    });
  }
};

// =====================================================
// IC CARD ENDPOINTS
// =====================================================

/**
 * Get All Cards for a Lock
 * GET /locks/:lockId/cards
 */
export const getCards = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { is_active } = req.query;

    let query = supabase
      .from('ic_cards')
      .select(`
        id,
        card_number,
        name,
        user_id,
        valid_from,
        valid_until,
        is_active,
        created_at,
        updated_at,
        user:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: cards, error } = await query;

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('relation') || error.code === 'PGRST204') {
        console.log('IC Cards table not found - returning empty list');
        return res.json({
          success: true,
          data: [],
          message: 'IC Cards feature not yet configured. Run migration 003_fingerprints_and_cards.sql'
        });
      }
      console.error('Get cards error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch cards'
        }
      });
    }

    res.json({
      success: true,
      data: cards || []
    });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch cards'
      }
    });
  }
};

/**
 * Add Card
 * POST /locks/:lockId/cards
 */
export const addCard = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      card_number,
      name,
      assigned_user_id,
      valid_from,
      valid_until
    } = req.body;

    console.log('📝 Adding IC card:', { lockId, card_number, name });

    // Check if card number already exists for this lock
    const { data: existing } = await supabase
      .from('ic_cards')
      .select('id')
      .eq('lock_id', lockId)
      .eq('card_number', card_number)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_CARD',
          message: 'This card is already registered'
        }
      });
    }

    const { data: card, error } = await supabase
      .from('ic_cards')
      .insert([{
        lock_id: lockId,
        card_number,
        name: name || 'IC Card',
        user_id: assigned_user_id || userId,
        valid_from: valid_from ? new Date(valid_from).toISOString() : null,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
        is_active: true,
        created_by: userId
      }])
      .select(`
        id,
        card_number,
        name,
        user_id,
        valid_from,
        valid_until,
        is_active,
        created_at
      `)
      .single();

    if (error) {
      console.error('Add card error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to add card',
          details: error.message
        }
      });
    }

    console.log('✅ Card added:', card.id);

    res.status(201).json({
      success: true,
      data: card
    });
  } catch (error) {
    console.error('Add card error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add card'
      }
    });
  }
};

/**
 * Update Card
 * PATCH /locks/:lockId/cards/:cardId
 */
export const updateCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const {
      name,
      assigned_user_id,
      valid_from,
      valid_until,
      is_active
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (assigned_user_id !== undefined) updates.user_id = assigned_user_id;
    if (valid_from !== undefined) updates.valid_from = new Date(valid_from).toISOString();
    if (valid_until !== undefined) updates.valid_until = new Date(valid_until).toISOString();
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: card, error } = await supabase
      .from('ic_cards')
      .update(updates)
      .eq('id', cardId)
      .select()
      .single();

    if (error || !card) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found'
        }
      });
    }

    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update card'
      }
    });
  }
};

/**
 * Delete Card
 * DELETE /locks/:lockId/cards/:cardId
 */
export const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;

    const { error } = await supabase
      .from('ic_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Delete card error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete card'
        }
      });
    }

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete card'
      }
    });
  }
};
