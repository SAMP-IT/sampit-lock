import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Helper function to convert user type code to text
 */
const getUserTypeText = (userType) => {
  const types = {
    110301: 'Admin',
    110302: 'Common User'
  };
  return types[userType] || `Unknown (${userType})`;
};

/**
 * Helper function to convert key status code to text
 */
const getKeyStatusText = (keyStatus) => {
  const statuses = {
    110401: 'Active',
    110402: 'Frozen',
    110405: 'Expired',
    110406: 'Deleted',
    110408: 'Reset'
  };
  return statuses[keyStatus] || `Unknown (${keyStatus})`;
};

/**
 * Send ekey to a user
 * @route POST /api/ttlock-v3/ekey/send
 */
export const sendEkey = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      receiverUsername,
      keyName,
      startDate,
      endDate,
      remarks,
      remoteEnable,
      createUser
    } = req.body;

    // Validation
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

    if (!receiverUsername) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RECEIVER_USERNAME',
          message: 'Receiver username (email/phone) is required'
        }
      });
    }

    if (!keyName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_NAME',
          message: 'Key name is required'
        }
      });
    }

    if (startDate === undefined || startDate === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_START_DATE',
          message: 'Start date is required (use 0 for permanent ekey)'
        }
      });
    }

    if (endDate === undefined || endDate === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_END_DATE',
          message: 'End date is required (use 0 for permanent ekey)'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      receiverUsername,
      keyName,
      startDate: parseInt(startDate),
      endDate: parseInt(endDate),
      date: Date.now()
    };

    // Add optional parameters
    if (remarks) {
      params.remarks = remarks;
    }
    if (remoteEnable !== undefined && remoteEnable !== null) {
      params.remoteEnable = parseInt(remoteEnable);
    }
    if (createUser !== undefined && createUser !== null) {
      params.createUser = parseInt(createUser);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/send`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to send ekey';
      let errorCode = 'SEND_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check all required fields';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3005) {
        errorMessage = 'Cannot send ekey to admin themselves';
        errorCode = 'CANNOT_SEND_TO_ADMIN';
      } else if (response.data.errcode === -3019) {
        errorMessage = 'User is already lock admin';
        errorCode = 'ALREADY_ADMIN';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can send ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Extract key ID from response
    const { keyId } = response.data;

    // Determine ekey type
    const isPermanent = startDate === 0 && endDate === 0;
    const ekeyType = isPermanent ? 'Permanent' : 'Timed';

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey sent successfully',
      data: {
        keyId,
        lockId: parseInt(lockId),
        receiverUsername,
        keyName,
        ekeyType,
        isPermanent,
        startDate: isPermanent ? null : startDate,
        endDate: isPermanent ? null : endDate,
        remarks: remarks || null,
        remoteEnable: remoteEnable ? parseInt(remoteEnable) : null,
        remoteUnlockEnabled: remoteEnable === 1,
        createUser: createUser ? parseInt(createUser) : null,
        accountCreated: createUser === 1,
        sentAt: new Date().toISOString(),
        notes: isPermanent
          ? 'Permanent ekey created - no expiration date'
          : `Ekey valid from ${new Date(startDate).toISOString()} to ${new Date(endDate).toISOString()}`,
        importantInfo: [
          receiverUsername.includes('@')
            ? 'Ekey sent to email address - receiver will receive notification'
            : 'Ekey sent to phone number - receiver will receive notification',
          'If receiver already had an ekey for this lock, it has been replaced',
          remoteEnable === 1
            ? 'Remote unlock is ENABLED for this ekey'
            : remoteEnable === 2
              ? 'Remote unlock is DISABLED for this ekey'
              : 'Remote unlock setting not specified',
          createUser === 1
            ? 'Account will be auto-created if receiver is not registered'
            : 'Receiver must have existing TTLock account'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Send ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to send ekey';
      let errorCode = 'SEND_EKEY_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -3005) {
        errorMessage = 'Cannot send ekey to admin themselves';
        errorCode = 'CANNOT_SEND_TO_ADMIN';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while sending ekey',
        details: error.message
      }
    });
  }
};

/**
 * Get ekey list with pagination and optional filters
 * @route POST /api/ttlock-v3/ekey/list
 */
export const getEkeyList = async (req, res) => {
  try {
    const {
      accessToken,
      pageNo,
      pageSize,
      lockAlias,
      groupId
    } = req.body;

    // Validation
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!pageNo) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PAGE_NO',
          message: 'Page number is required (starts from 1)'
        }
      });
    }

    if (!pageSize) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PAGE_SIZE',
          message: 'Page size is required (max 10000)'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    // Add optional filters
    if (lockAlias) {
      params.lockAlias = lockAlias;
    }
    if (groupId) {
      params.groupId = parseInt(groupId);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/list`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get ekey list';
      let errorCode = 'GET_EKEY_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check pageNo and pageSize';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Extract ekey list from response
    const { list = [], pages = 0, pageNo: currentPage = 1, pageSize: size = 0, total = 0 } = response.data;

    // Enhanced response with processed ekey data
    const processedEkeys = list.map(ekey => {
      const isPermanent = ekey.startDate === 0 && ekey.endDate === 0;
      const isExpired = ekey.keyStatus === 110405;
      const isActive = ekey.keyStatus === 110401;
      const isFrozen = ekey.keyStatus === 110402;
      const isDeleted = ekey.keyStatus === 110406;
      const isReset = ekey.keyStatus === 110408;
      const isAdmin = ekey.userType === 110301;
      const hasRemoteUnlock = ekey.remoteEnable === 1;

      return {
        ...ekey,
        // User type information
        userTypeText: getUserTypeText(ekey.userType),
        isAdmin,
        isCommonUser: !isAdmin,

        // Key status information
        keyStatusText: getKeyStatusText(ekey.keyStatus),
        isActive,
        isFrozen,
        isExpired,
        isDeleted,
        isReset,

        // Ekey type information
        ekeyType: isPermanent ? 'Permanent' : 'Timed',
        isPermanent,
        isTimed: !isPermanent,

        // Validity period
        validFrom: isPermanent ? null : new Date(ekey.startDate).toISOString(),
        validUntil: isPermanent ? null : new Date(ekey.endDate).toISOString(),

        // Remote unlock information
        remoteUnlockText: hasRemoteUnlock ? 'Enabled' : 'Disabled',
        hasRemoteUnlock,

        // Lock information
        lockBatteryLevel: ekey.electricQuantity,
        lockHasNoKeyPwd: ekey.noKeyPwd === 'yes',

        // Timestamps
        receivedAt: ekey.createDate ? new Date(ekey.createDate).toISOString() : null,
        lastUpdated: ekey.updateDate ? new Date(ekey.updateDate).toISOString() : null
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Ekey list retrieved successfully',
      data: {
        ekeys: processedEkeys,
        pagination: {
          currentPage: parseInt(currentPage),
          pageSize: parseInt(size),
          totalPages: parseInt(pages),
          totalEkeys: parseInt(total),
          hasNextPage: parseInt(currentPage) < parseInt(pages),
          hasPreviousPage: parseInt(currentPage) > 1
        },
        filters: {
          lockAlias: lockAlias || null,
          groupId: groupId ? parseInt(groupId) : null,
          filtersApplied: !!(lockAlias || groupId)
        },
        summary: {
          totalEkeysInPage: list.length,
          adminEkeys: processedEkeys.filter(e => e.isAdmin).length,
          commonUserEkeys: processedEkeys.filter(e => e.isCommonUser).length,
          activeEkeys: processedEkeys.filter(e => e.isActive).length,
          expiredEkeys: processedEkeys.filter(e => e.isExpired).length,
          frozenEkeys: processedEkeys.filter(e => e.isFrozen).length,
          permanentEkeys: processedEkeys.filter(e => e.isPermanent).length,
          timedEkeys: processedEkeys.filter(e => e.isTimed).length,
          remoteUnlockEnabled: processedEkeys.filter(e => e.hasRemoteUnlock).length
        }
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Get ekey list error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to get ekey list';
      let errorCode = 'GET_EKEY_LIST_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while getting ekey list',
        details: error.message
      }
    });
  }
};

/**
 * Get one ekey of an account
 * @route POST /api/ttlock-v3/ekey/get
 */
export const getEkey = async (req, res) => {
  try {
    const {
      accessToken,
      lockId
    } = req.body;

    // Validation
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

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/get`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get ekey';
      let errorCode = 'GET_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check lock ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have an ekey for this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3005) {
        errorMessage = 'No ekey found for this lock';
        errorCode = 'NO_EKEY_FOUND';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Extract ekey data from response
    const ekey = response.data;

    // Process ekey information
    const isPermanent = ekey.startDate === 0 && ekey.endDate === 0;
    const isExpired = ekey.keyStatus === '110405';
    const isActive = ekey.keyStatus === '110401';
    const isFrozen = ekey.keyStatus === '110402';
    const isDeleted = ekey.keyStatus === '110406';
    const isReset = ekey.keyStatus === '110408';
    const isAdmin = ekey.userType === '110301';
    const hasRemoteUnlock = ekey.remoteEnable === 1;
    const isAuthorized = ekey.keyRight === 1;

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey retrieved successfully',
      data: {
        // Basic ekey information
        keyId: ekey.keyId,
        lockId: ekey.lockId,
        lockName: ekey.lockName,
        lockAlias: ekey.lockAlias || null,
        lockMac: ekey.lockMac,

        // User type information
        userType: ekey.userType,
        userTypeText: getUserTypeText(ekey.userType),
        isAdmin,
        isCommonUser: !isAdmin,

        // Key status information
        keyStatus: ekey.keyStatus,
        keyStatusText: getKeyStatusText(ekey.keyStatus),
        isActive,
        isFrozen,
        isExpired,
        isDeleted,
        isReset,

        // Ekey type information
        ekeyType: isPermanent ? 'Permanent' : 'Timed',
        isPermanent,
        isTimed: !isPermanent,

        // Validity period
        startDate: isPermanent ? null : ekey.startDate,
        endDate: isPermanent ? null : ekey.endDate,
        validFrom: isPermanent ? null : new Date(ekey.startDate).toISOString(),
        validUntil: isPermanent ? null : new Date(ekey.endDate).toISOString(),

        // Authorization and features
        keyRight: ekey.keyRight,
        isAuthorized,
        remoteEnable: ekey.remoteEnable,
        remoteUnlockText: hasRemoteUnlock ? 'Enabled' : 'Disabled',
        hasRemoteUnlock,

        // Lock information
        electricQuantity: ekey.electricQuantity,
        lockBatteryLevel: ekey.electricQuantity,
        lockVersion: ekey.lockVersion,

        // Passcodes
        noKeyPwd: ekey.noKeyPwd || null,
        superPasscode: ekey.noKeyPwd || null,
        deletePwd: ekey.deletePwd || null,
        keyboardPwdVersion: ekey.keyboardPwdVersion,

        // Additional information
        remarks: ekey.remarks || null,
        specialValue: ekey.specialValue,
        lockData: ekey.lockData,

        // Timestamps
        retrievedAt: new Date().toISOString()
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Get ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to get ekey';
      let errorCode = 'GET_EKEY_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while getting ekey',
        details: error.message
      }
    });
  }
};

/**
 * Delete ekey
 * @route POST /api/ttlock-v3/ekey/delete
 */
export const deleteEkey = async (req, res) => {
  try {
    const {
      accessToken,
      keyId
    } = req.body;

    // Validation
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/delete`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete ekey';
      let errorCode = 'DELETE_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to delete this ekey';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can delete ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey deleted successfully',
      data: {
        keyId: parseInt(keyId),
        deletedAt: new Date().toISOString(),
        notes: [
          'Ekey has been permanently deleted from the cloud server',
          'User can no longer access the lock with this ekey',
          'If this was an admin ekey, ALL ekeys and passcodes for the lock have been deleted'
        ],
        criticalWarning: 'DELETING ADMIN EKEY REMOVES ALL ACCESS - All ekeys and passcodes for the lock are deleted when admin ekey is deleted'
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Delete ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to delete ekey';
      let errorCode = 'DELETE_EKEY_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while deleting ekey',
        details: error.message
      }
    });
  }
};

/**
 * Freeze the ekey (temporarily disable)
 * @route POST /api/ttlock-v3/ekey/freeze
 */
export const freezeEkey = async (req, res) => {
  try {
    const {
      accessToken,
      keyId
    } = req.body;

    // Validation
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/freeze`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to freeze ekey';
      let errorCode = 'FREEZE_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to freeze this ekey';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can freeze ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      } else if (response.data.errcode === -3001) {
        errorMessage = 'Ekey is already frozen';
        errorCode = 'ALREADY_FROZEN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey frozen successfully',
      data: {
        keyId: parseInt(keyId),
        frozenAt: new Date().toISOString(),
        status: 'Frozen',
        notes: [
          'Ekey has been temporarily disabled',
          'User can no longer unlock the lock with this ekey',
          'Ekey can be unfrozen later to restore access',
          'This is reversible - use unfreeze to enable again'
        ],
        whatHappened: {
          ekeyStatus: 'Changed from Active to Frozen',
          userAccess: 'Temporarily disabled',
          unlockability: 'User cannot unlock the lock',
          reversible: 'Yes - can be unfrozen'
        },
        useCases: [
          'Temporarily suspend access for security reasons',
          'Disable access during vacation/absence',
          'Pause access while investigating issues',
          'Test access control without permanent deletion'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Freeze ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to freeze ekey';
      let errorCode = 'FREEZE_EKEY_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while freezing ekey',
        details: error.message
      }
    });
  }
};

/**
 * Unfreeze the ekey (re-enable)
 * @route POST /api/ttlock-v3/ekey/unfreeze
 */
export const unfreezeEkey = async (req, res) => {
  try {
    const {
      accessToken,
      keyId
    } = req.body;

    // Validation
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/unfreeze`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to unfreeze ekey';
      let errorCode = 'UNFREEZE_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to unfreeze this ekey';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can unfreeze ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      } else if (response.data.errcode === -3002) {
        errorMessage = 'Ekey is not frozen - it is already active';
        errorCode = 'NOT_FROZEN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey unfrozen successfully',
      data: {
        keyId: parseInt(keyId),
        unfrozenAt: new Date().toISOString(),
        status: 'Active',
        notes: [
          'Ekey has been re-enabled',
          'User can now unlock the lock with this ekey',
          'Access has been restored',
          'Ekey is now active and functional'
        ],
        whatHappened: {
          ekeyStatus: 'Changed from Frozen to Active',
          userAccess: 'Restored',
          unlockability: 'User can now unlock the lock',
          validityPeriod: 'Unchanged - original dates still apply'
        },
        importantNotes: [
          'If ekey was timed, check validity period is still current',
          'User should refresh their app to see updated status',
          'Ekey can be frozen again if needed'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Unfreeze ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to unfreeze ekey';
      let errorCode = 'UNFREEZE_EKEY_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while unfreezing ekey',
        details: error.message
      }
    });
  }
};

/**
 * Change the valid time of the ekey
 * @route POST /api/ttlock-v3/ekey/change-period
 */
export const changeEkeyPeriod = async (req, res) => {
  try {
    const {
      accessToken,
      keyId,
      startDate,
      endDate
    } = req.body;

    // Validation
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    if (startDate === undefined || startDate === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_START_DATE',
          message: 'Start date is required (use 0 for permanent ekey)'
        }
      });
    }

    if (endDate === undefined || endDate === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_END_DATE',
          message: 'End date is required (use 0 for permanent ekey)'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      startDate: parseInt(startDate),
      endDate: parseInt(endDate),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/changePeriod`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to change ekey period';
      let errorCode = 'CHANGE_PERIOD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check dates and ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to change this ekey period';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can change ekey period';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Determine ekey type
    const isPermanent = parseInt(startDate) === 0 && parseInt(endDate) === 0;
    const ekeyType = isPermanent ? 'Permanent' : 'Timed';

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey validity period changed successfully',
      data: {
        keyId: parseInt(keyId),
        ekeyType,
        isPermanent,
        isTimed: !isPermanent,
        startDate: isPermanent ? null : parseInt(startDate),
        endDate: isPermanent ? null : parseInt(endDate),
        validFrom: isPermanent ? null : new Date(parseInt(startDate)).toISOString(),
        validUntil: isPermanent ? null : new Date(parseInt(endDate)).toISOString(),
        changedAt: new Date().toISOString(),
        notes: [
          'Ekey validity period has been updated',
          'User can access lock during new time period',
          isPermanent ? 'Ekey is now permanent (never expires)' : 'Ekey is now timed (expires after period)',
          'User should refresh their app to see updated period'
        ],
        whatHappened: {
          operation: 'Validity period changed',
          newType: ekeyType,
          effectiveImmediately: 'Yes',
          userNotified: 'User will receive notification'
        },
        useCases: [
          'Extend access for longer period',
          'Shorten access to expire sooner',
          'Convert timed ekey to permanent',
          'Convert permanent ekey to timed',
          'Adjust dates based on changing needs'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Change ekey period error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to change ekey period';
      let errorCode = 'CHANGE_PERIOD_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while changing ekey period',
        details: error.message
      }
    });
  }
};

/**
 * Key authorization - grant admin rights to common user
 * @route POST /api/ttlock-v3/ekey/authorize
 */
export const authorizeEkey = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyId
    } = req.body;

    // Validation
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

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyId: parseInt(keyId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/authorize`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to authorize ekey';
      let errorCode = 'AUTHORIZE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check lock ID and ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to authorize this ekey';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can authorize ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      } else if (response.data.errcode === -3020) {
        errorMessage = 'Ekey is already authorized';
        errorCode = 'ALREADY_AUTHORIZED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey authorized successfully - admin rights granted',
      data: {
        keyId: parseInt(keyId),
        lockId: parseInt(lockId),
        authorizedAt: new Date().toISOString(),
        keyRight: 1,
        isAuthorized: true,
        adminRights: 'Granted',
        notes: [
          'User has been granted administrator rights for this lock',
          'User can now perform admin operations',
          'User can send ekeys to others',
          'User can manage lock settings',
          'Authorization can be revoked later'
        ],
        whatHappened: {
          userType: 'Still Common User (110302)',
          keyRight: 'Changed to 1 (Authorized)',
          capabilities: 'Admin-level operations enabled',
          reversible: 'Yes - can be unauthorized'
        },
        newCapabilities: [
          'Send ekeys to other users',
          'Manage passcodes',
          'View unlock records',
          'Modify lock settings',
          'Add/remove IC cards and fingerprints',
          'Manage gateway settings',
          'Access admin features in app'
        ],
        limitations: [
          'Cannot delete the lock (only original admin can)',
          'Cannot transfer lock ownership',
          'Original admin retains ultimate control'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Authorize ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to authorize ekey';
      let errorCode = 'AUTHORIZE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while authorizing ekey',
        details: error.message
      }
    });
  }
};

/**
 * Cancel key authorization - remove admin rights from common user
 * @route POST /api/ttlock-v3/ekey/unauthorize
 */
export const unauthorizeEkey = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyId
    } = req.body;

    // Validation
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

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEY_ID',
          message: 'Ekey ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyId: parseInt(keyId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/unauthorize`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to unauthorize ekey';
      let errorCode = 'UNAUTHORIZE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check lock ID and ekey ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have permission to unauthorize this ekey';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only lock admin can unauthorize ekeys';
        errorCode = 'NOT_LOCK_ADMIN';
      } else if (response.data.errcode === -3021) {
        errorMessage = 'Ekey is not authorized - it does not have admin rights';
        errorCode = 'NOT_AUTHORIZED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode,
          ttlock_errmsg: response.data.errmsg || response.data.description
        }
      });
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Ekey unauthorized successfully - admin rights removed',
      data: {
        keyId: parseInt(keyId),
        lockId: parseInt(lockId),
        unauthorizedAt: new Date().toISOString(),
        keyRight: 0,
        isAuthorized: false,
        adminRights: 'Removed',
        notes: [
          'Administrator rights have been removed from this user',
          'User can still unlock the lock',
          'User can no longer perform admin operations',
          'User cannot send ekeys to others',
          'User reverts to standard access level'
        ],
        whatHappened: {
          userType: 'Still Common User (110302)',
          keyRight: 'Changed to 0 (Not Authorized)',
          capabilities: 'Standard user operations only',
          reversible: 'Yes - can be authorized again'
        },
        remainingCapabilities: [
          'Unlock the lock via app or Bluetooth',
          'View own ekey details',
          'Receive notifications',
          'Use passcodes (if provided)'
        ],
        removedCapabilities: [
          'Cannot send ekeys to others',
          'Cannot manage passcodes',
          'Cannot view all unlock records',
          'Cannot modify lock settings',
          'Cannot add/remove IC cards and fingerprints',
          'Cannot manage gateway settings',
          'No access to admin features'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Unauthorize ekey error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to unauthorize ekey';
      let errorCode = 'UNAUTHORIZE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -1009) {
        errorMessage = 'Ekey not found';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === -3015) {
        errorMessage = 'Ekey record does not exist';
        errorCode = 'EKEY_NOT_FOUND';
      } else if (error.response.data.errcode === 20002) {
        errorMessage = 'Not lock admin';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      return res.status(error.response.status || 400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: error.response.data.errcode,
          ttlock_errmsg: error.response.data.errmsg || error.response.data.description
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error while unauthorizing ekey',
        details: error.message
      }
    });
  }
};
