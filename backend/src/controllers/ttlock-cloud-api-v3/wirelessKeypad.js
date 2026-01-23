import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Add Wireless Keypad
 * Add a wireless keypad to a lock
 * Endpoint: POST /v3/wirelessKeypad/add
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {string} req.body.wirelessKeypadNumber - Wireless keypad serial number
 * @param {string} req.body.wirelessKeypadName - Wireless keypad name
 * @param {string} req.body.wirelessKeypadMac - Wireless keypad MAC address
 * @param {string} req.body.wirelessKeypadFeatureValue - Feature value of wireless keypad
 * @returns {Object} Response with wireless keypad ID
 */
export const addWirelessKeypad = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      wirelessKeypadNumber,
      wirelessKeypadName,
      wirelessKeypadMac,
      wirelessKeypadFeatureValue
    } = req.body;

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

    if (!wirelessKeypadNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_NUMBER',
          message: 'Wireless keypad serial number is required'
        }
      });
    }

    if (!wirelessKeypadName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_NAME',
          message: 'Wireless keypad name is required'
        }
      });
    }

    if (!wirelessKeypadMac) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_MAC',
          message: 'Wireless keypad MAC address is required'
        }
      });
    }

    if (!wirelessKeypadFeatureValue) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FEATURE_VALUE',
          message: 'Wireless keypad feature value is required'
        }
      });
    }

    console.log('⌨️  TTLock Add Wireless Keypad');
    console.log('   Lock ID:', lockId);
    console.log('   Keypad Name:', wirelessKeypadName);
    console.log('   Keypad Number:', wirelessKeypadNumber);
    console.log('   Keypad MAC:', wirelessKeypadMac);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      wirelessKeypadNumber: wirelessKeypadNumber,
      wirelessKeypadName: wirelessKeypadName,
      wirelessKeypadMac: wirelessKeypadMac,
      wirelessKeypadFeatureValue: wirelessKeypadFeatureValue,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Add Wireless Keypad API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/add`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock add wireless keypad error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add wireless keypad';
      let errorCode = 'ADD_WIRELESS_KEYPAD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check keypad number, MAC, or feature value';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can add wireless keypads';
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

    const { wirelessKeypadId } = response.data;

    console.log('✅ Wireless keypad added successfully');
    console.log('   Wireless Keypad ID:', wirelessKeypadId);

    // Return response
    res.json({
      success: true,
      message: 'Wireless keypad added successfully',
      data: {
        wirelessKeypadId: wirelessKeypadId,
        lockId: lockId,
        wirelessKeypadNumber: wirelessKeypadNumber,
        wirelessKeypadName: wirelessKeypadName,
        wirelessKeypadMac: wirelessKeypadMac,
        addedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Add wireless keypad error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to add wireless keypad',
        details: error.message
      }
    });
  }
};

/**
 * Rename Wireless Keypad
 * Rename a wireless keypad
 * Endpoint: POST /v3/wirelessKeypad/rename
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.wirelessKeypadId - Wireless keypad ID
 * @param {string} req.body.wirelessKeypadName - New wireless keypad name
 * @returns {Object} Response confirming rename
 */
export const renameWirelessKeypad = async (req, res) => {
  try {
    const { accessToken, wirelessKeypadId, wirelessKeypadName } = req.body;

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

    if (!wirelessKeypadId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_ID',
          message: 'Wireless keypad ID is required'
        }
      });
    }

    if (!wirelessKeypadName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_NAME',
          message: 'Wireless keypad name is required'
        }
      });
    }

    console.log('✏️  TTLock Rename Wireless Keypad');
    console.log('   Wireless Keypad ID:', wirelessKeypadId);
    console.log('   New Name:', wirelessKeypadName);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      wirelessKeypadId: wirelessKeypadId,
      wirelessKeypadName: wirelessKeypadName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Rename Wireless Keypad API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/rename`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock rename wireless keypad error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to rename wireless keypad';
      let errorCode = 'RENAME_WIRELESS_KEYPAD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check keypad ID or name';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Wireless keypad not found';
        errorCode = 'KEYPAD_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this wireless keypad';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Wireless keypad record does not exist';
        errorCode = 'KEYPAD_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can rename wireless keypads';
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

    console.log('✅ Wireless keypad renamed successfully');

    // Return response
    res.json({
      success: true,
      message: 'Wireless keypad renamed successfully',
      data: {
        wirelessKeypadId: wirelessKeypadId,
        newName: wirelessKeypadName,
        renamedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Rename wireless keypad error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to rename wireless keypad',
        details: error.message
      }
    });
  }
};

/**
 * Delete Wireless Keypad
 * Delete a wireless keypad
 * Endpoint: POST /v3/wirelessKeypad/delete
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.wirelessKeypadId - Wireless keypad ID
 * @returns {Object} Response confirming deletion
 */
export const deleteWirelessKeypad = async (req, res) => {
  try {
    const { accessToken, wirelessKeypadId } = req.body;

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

    if (!wirelessKeypadId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYPAD_ID',
          message: 'Wireless keypad ID is required'
        }
      });
    }

    console.log('🗑️  TTLock Delete Wireless Keypad');
    console.log('   Wireless Keypad ID:', wirelessKeypadId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      wirelessKeypadId: wirelessKeypadId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Wireless Keypad API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/delete`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete wireless keypad error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete wireless keypad';
      let errorCode = 'DELETE_WIRELESS_KEYPAD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check wireless keypad ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Wireless keypad not found';
        errorCode = 'KEYPAD_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this wireless keypad';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Wireless keypad record does not exist';
        errorCode = 'KEYPAD_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can delete wireless keypads';
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

    console.log('✅ Wireless keypad deleted successfully');

    // Return response
    res.json({
      success: true,
      message: 'Wireless keypad deleted successfully',
      data: {
        wirelessKeypadId: wirelessKeypadId,
        deletedAt: new Date().toISOString(),
        note: 'The wireless keypad has been permanently removed and can no longer be used to unlock.'
      }
    });
  } catch (error) {
    console.error('❌ Delete wireless keypad error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete wireless keypad',
        details: error.message
      }
    });
  }
};

/**
 * Get Wireless Keypads of a Lock
 * Get list of all wireless keypads for a specific lock
 * Endpoint: POST /v3/wirelessKeypad/listByLock
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @returns {Object} Response with list of wireless keypads
 */
export const getWirelessKeypadsByLock = async (req, res) => {
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

    console.log('📋 TTLock Get Wireless Keypads by Lock');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Wireless Keypads by Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/listByLock`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get wireless keypads error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get wireless keypads';
      let errorCode = 'GET_WIRELESS_KEYPADS_FAILED';

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

    const { list = [] } = response.data;

    console.log('✅ Wireless keypads retrieved successfully');
    console.log('   Total Keypads:', list.length);

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'Wireless keypads retrieved successfully',
      data: {
        lockId: lockId,
        wirelessKeypads: list.map(keypad => ({
          wirelessKeypadId: keypad.wirelessKeypadId,
          wirelessKeypadNumber: keypad.wirelessKeypadNumber,
          wirelessKeypadName: keypad.wirelessKeypadName,
          wirelessKeypadMac: keypad.wirelessKeypadMac
        })),
        totalCount: list.length
      }
    });
  } catch (error) {
    console.error('❌ Get wireless keypads error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get wireless keypads',
        details: error.message
      }
    });
  }
};
