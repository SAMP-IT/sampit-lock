import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get IC Card List
 * Get all IC cards of a lock with pagination
 * Endpoint: POST /v3/identityCard/list
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.pageNo - Page number (start from 1)
 * @param {number} req.body.pageSize - Items per page (default 20, max 100)
 * @returns {Object} Response with list of IC cards
 */
export const getICCardList = async (req, res) => {
  try {
    const { accessToken, lockId, pageNo, pageSize } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!pageNo) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PAGE_NO',
          message: 'Page number is required'
        }
      });
    }

    if (!pageSize) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PAGE_SIZE',
          message: 'Page size is required'
        }
      });
    }

    // Validate pageSize range
    if (pageSize > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE_SIZE',
          message: 'Page size must not exceed 100'
        }
      });
    }

    console.log('=� TTLock Get IC Card List');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo);
    console.log('   Page Size:', pageSize);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    console.log('=� Calling TTLock Get IC Card List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/list`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock get IC card list error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get IC card list';
      let errorCode = 'GET_IC_CARD_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list = [], pages = 0, pageNo: currentPage = pageNo, pageSize: currentPageSize = pageSize, total = 0 } = response.data;

    console.log(' IC card list retrieved successfully');
    console.log('   Total Cards:', total);
    console.log('   Current Page:', currentPage);
    console.log('   Total Pages:', pages);

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'IC card list retrieved successfully',
      data: {
        lockId: lockId,
        cards: list.map(card => ({
          cardId: card.cardId,
          lockId: card.lockId,
          cardNumber: card.cardNumber,
          cardName: card.cardName,
          startDate: card.startDate,
          endDate: card.endDate,
          createDate: card.createDate,
          status: card.status,
          statusText: getCardStatusText(card.status),
          senderUsername: card.senderUsername,
          isValid: card.status === 1,
          isExpired: card.status === 2,
          isPending: card.status === 3 || card.status === 4 || card.status === 6 || card.status === 8,
          hasFailed: card.status === 5 || card.status === 7 || card.status === 9
        })),
        pagination: {
          pageNo: currentPage,
          pageSize: currentPageSize,
          totalPages: pages,
          totalCards: total,
          hasNextPage: currentPage < pages,
          hasPreviousPage: currentPage > 1
        }
      }
    });
  } catch (error) {
    console.error('L Get IC card list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get IC card list',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert status code to text
 * @param {number} status - Status code
 * @returns {string} Status text
 */
function getCardStatusText(status) {
  const statusMap = {
    1: 'Normal',
    2: 'Invalid or Expired',
    3: 'Pending',
    4: 'Adding',
    5: 'Add Failed',
    6: 'Modifying',
    7: 'Modify Failed',
    8: 'Deleting',
    9: 'Delete Failed'
  };
  return statusMap[status] || 'Unknown';
}

/**
 * Add IC Card
 * Call this API after calling the SDK method to add an IC card
 * Endpoint: POST /v3/identityCard/addForReversedCardNumber
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {string} req.body.cardNumber - IC card number
 * @param {string} req.body.cardName - IC card name (optional)
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {number} req.body.addType - Adding method: 1=bluetooth, 2=gateway, 3=NB-IoT (optional, default=1)
 * @returns {Object} Response with card ID
 */
export const addICCard = async (req, res) => {
  try {
    const { accessToken, lockId, cardNumber, cardName, startDate, endDate, addType } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CARD_NUMBER',
          message: 'Card number is required'
        }
      });
    }

    console.log('➕ TTLock Add IC Card');
    console.log('   Lock ID:', lockId);
    console.log('   Card Number:', cardNumber);
    if (cardName) console.log('   Card Name:', cardName);
    if (addType) console.log('   Add Type:', getAddTypeText(addType));

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      cardNumber: cardNumber,
      date: Date.now()
    };

    // Add optional parameters
    if (cardName) params.cardName = cardName;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (addType) params.addType = addType;

    console.log('📡 Calling TTLock Add IC Card API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/addForReversedCardNumber`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock add IC card error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add IC card';
      let errorCode = 'ADD_IC_CARD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3006) {
        errorMessage = 'Card number already exists';
        errorCode = 'CARD_ALREADY_EXISTS';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can add IC cards';
        errorCode = 'NOT_LOCK_ADMIN';
      } else if (response.data.errcode === 90000) {
        errorMessage = 'Internal server error - lock may not support IC cards or card number format is invalid';
        errorCode = 'SERVER_ERROR';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { cardId } = response.data;

    console.log('✅ IC card added successfully');
    console.log('   Card ID:', cardId);

    // Return response
    res.json({
      success: true,
      message: 'IC card added successfully',
      data: {
        cardId: cardId,
        lockId: lockId,
        cardNumber: cardNumber,
        cardName: cardName || null,
        startDate: startDate || null,
        endDate: endDate || null,
        addType: addType || 1,
        addTypeText: getAddTypeText(addType || 1),
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Add IC card error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to add IC card',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert addType to text
 * @param {number} addType - Add type code
 * @returns {string} Add type text
 */
function getAddTypeText(addType) {
  const typeMap = {
    1: 'Phone Bluetooth (SDK required first)',
    2: 'Gateway (Direct add)',
    3: 'NB-IoT'
  };
  return typeMap[addType] || 'Phone Bluetooth (Default)';
}

/**
 * Delete IC Card
 * Call this API after calling the SDK method to delete an IC card
 * Endpoint: POST /v3/identityCard/delete
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.cardId - IC card ID
 * @param {number} req.body.deleteType - Delete method: 1=bluetooth, 2=gateway, 3=NB-IoT (optional, default=1)
 * @returns {Object} Response confirming deletion
 */
export const deleteICCard = async (req, res) => {
  try {
    const { accessToken, lockId, cardId, deleteType } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CARD_ID',
          message: 'Card ID is required'
        }
      });
    }

    console.log('🗑️  TTLock Delete IC Card');
    console.log('   Lock ID:', lockId);
    console.log('   Card ID:', cardId);
    if (deleteType) console.log('   Delete Type:', getDeleteTypeText(deleteType));

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      cardId: cardId,
      date: Date.now()
    };

    // Add optional deleteType parameter
    if (deleteType) params.deleteType = deleteType;

    console.log('📡 Calling TTLock Delete IC Card API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/delete`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete IC card error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete IC card';
      let errorCode = 'DELETE_IC_CARD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3005) {
        errorMessage = 'Card not found';
        errorCode = 'CARD_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can delete IC cards';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ IC card deleted successfully');

    // Return response
    res.json({
      success: true,
      message: 'IC card deleted successfully',
      data: {
        cardId: cardId,
        lockId: lockId,
        deleteType: deleteType || 1,
        deleteTypeText: getDeleteTypeText(deleteType || 1),
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Delete IC card error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete IC card',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert deleteType to text
 * @param {number} deleteType - Delete type code
 * @returns {string} Delete type text
 */
function getDeleteTypeText(deleteType) {
  const typeMap = {
    1: 'Phone Bluetooth (SDK required first)',
    2: 'Gateway (Direct delete)',
    3: 'NB-IoT'
  };
  return typeMap[deleteType] || 'Phone Bluetooth (Default)';
}

/**
 * Clear All IC Cards
 * Call this API after calling the SDK method to clear all IC cards from a lock
 * WARNING: This removes ALL IC cards from the lock
 * Endpoint: POST /v3/identityCard/clear
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @returns {Object} Response confirming all cards cleared
 */
export const clearICCards = async (req, res) => {
  try {
    const { accessToken, lockId } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    console.log('🗑️  TTLock Clear All IC Cards');
    console.log('   Lock ID:', lockId);
    console.log('   ⚠️  WARNING: This will remove ALL IC cards from the lock');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear IC Cards API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/clear`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock clear IC cards error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to clear IC cards';
      let errorCode = 'CLEAR_IC_CARDS_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can clear IC cards';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ All IC cards cleared successfully');
    console.log('   All IC cards have been removed from lock');

    // Return response
    res.json({
      success: true,
      message: 'All IC cards cleared successfully',
      data: {
        lockId: lockId,
        clearedAt: new Date().toISOString(),
        warning: 'All IC cards have been permanently removed from this lock'
      }
    });
  } catch (error) {
    console.error('❌ Clear IC cards error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to clear IC cards',
        details: error.message
      }
    });
  }
};

/**
 * Change IC Card Validity Period
 * Change the period of validity of IC card via gateway or bluetooth
 * Endpoint: POST /v3/identityCard/changePeriod
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.cardId - IC card ID
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {number} req.body.changeType - Change method: 1=bluetooth, 2=gateway, 3=NB-IoT (optional, default=1)
 * @returns {Object} Response confirming validity period change
 */
export const changeICCardPeriod = async (req, res) => {
  try {
    const { accessToken, lockId, cardId, startDate, endDate, changeType } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CARD_ID',
          message: 'Card ID is required'
        }
      });
    }

    console.log('📅 TTLock Change IC Card Validity Period');
    console.log('   Lock ID:', lockId);
    console.log('   Card ID:', cardId);
    if (startDate) console.log('   New Start Date:', new Date(startDate).toISOString());
    if (endDate) console.log('   New End Date:', new Date(endDate).toISOString());
    if (changeType) console.log('   Change Type:', getChangeTypeText(changeType));

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      cardId: cardId,
      date: Date.now()
    };

    // Add optional parameters
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (changeType) params.changeType = changeType;

    console.log('📡 Calling TTLock Change IC Card Period API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/changePeriod`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock change IC card period error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to change IC card validity period';
      let errorCode = 'CHANGE_PERIOD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3005) {
        errorMessage = 'Card not found';
        errorCode = 'CARD_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can change IC card periods';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ IC card validity period changed successfully');

    // Return response
    res.json({
      success: true,
      message: 'IC card validity period changed successfully',
      data: {
        cardId: cardId,
        lockId: lockId,
        startDate: startDate || null,
        endDate: endDate || null,
        changeType: changeType || 1,
        changeTypeText: getChangeTypeText(changeType || 1),
        changedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Change IC card period error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to change IC card validity period',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert changeType to text
 * @param {number} changeType - Change type code
 * @returns {string} Change type text
 */
function getChangeTypeText(changeType) {
  const typeMap = {
    1: 'Phone Bluetooth (SDK required first)',
    2: 'Gateway (Direct change)',
    3: 'NB-IoT'
  };
  return typeMap[changeType] || 'Phone Bluetooth (Default)';
}
