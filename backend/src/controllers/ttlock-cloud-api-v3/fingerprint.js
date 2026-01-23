import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get Fingerprint List
 * Get all fingerprints of a lock with pagination
 * Endpoint: POST /v3/fingerprint/list
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.pageNo - Page number (start from 1)
 * @param {number} req.body.pageSize - Items per page (default 20, max 100)
 * @returns {Object} Response with list of fingerprints
 */
export const getFingerprintList = async (req, res) => {
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

    console.log('=F TTLock Get Fingerprint List');
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

    console.log('=� Calling TTLock Get Fingerprint List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/list`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock get fingerprint list error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get fingerprint list';
      let errorCode = 'GET_FINGERPRINT_LIST_FAILED';

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

    console.log(' Fingerprint list retrieved successfully');
    console.log('   Total Fingerprints:', total);
    console.log('   Current Page:', currentPage);
    console.log('   Total Pages:', pages);

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'Fingerprint list retrieved successfully',
      data: {
        lockId: lockId,
        fingerprints: list.map(fp => ({
          fingerprintId: fp.fingerprintId,
          lockId: fp.lockId,
          fingerprintNumber: fp.fingerprintNumber,
          fingerprintType: fp.fingerprintType,
          fingerprintTypeText: getFingerprintTypeText(fp.fingerprintType),
          fingerprintName: fp.fingerprintName,
          startDate: fp.startDate,
          endDate: fp.endDate,
          cyclicConfig: fp.cyclicConfig,
          createDate: fp.createDate,
          status: fp.status,
          statusText: getFingerprintStatusText(fp.status),
          senderUsername: fp.senderUsername,
          isNormal: fp.fingerprintType === 1,
          isCyclic: fp.fingerprintType === 4,
          isValid: fp.status === 1,
          isExpired: fp.status === 2,
          isPending: fp.status === 3 || fp.status === 4 || fp.status === 6 || fp.status === 8,
          hasFailed: fp.status === 5 || fp.status === 7 || fp.status === 9
        })),
        pagination: {
          pageNo: currentPage,
          pageSize: currentPageSize,
          totalPages: pages,
          totalFingerprints: total,
          hasNextPage: currentPage < pages,
          hasPreviousPage: currentPage > 1
        }
      }
    });
  } catch (error) {
    console.error('L Get fingerprint list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get fingerprint list',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert fingerprint type code to text
 * @param {number} type - Fingerprint type code
 * @returns {string} Fingerprint type text
 */
function getFingerprintTypeText(type) {
  const typeMap = {
    1: 'Normal',
    4: 'Cyclic'
  };
  return typeMap[type] || 'Unknown';
}

/**
 * Helper function to convert status code to text
 * @param {number} status - Status code
 * @returns {string} Status text
 */
function getFingerprintStatusText(status) {
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
 * Add Fingerprint
 * Call this API after a fingerprint has been added to the lock
 * Endpoint: POST /v3/fingerprint/add
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {string} req.body.fingerprintNumber - Fingerprint code
 * @param {number} req.body.fingerprintType - Fingerprint type: 1=normal, 4=cyclic
 * @param {string} req.body.fingerprintName - Fingerprint name (optional)
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {Array} req.body.cyclicConfig - Cyclic time configuration (optional)
 * @returns {Object} Response with fingerprint ID
 */
export const addFingerprint = async (req, res) => {
  try {
    const { accessToken, lockId, fingerprintNumber, fingerprintType, fingerprintName, startDate, endDate, cyclicConfig } = req.body;

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

    if (!fingerprintNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FINGERPRINT_NUMBER',
          message: 'Fingerprint number is required'
        }
      });
    }

    if (!fingerprintType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FINGERPRINT_TYPE',
          message: 'Fingerprint type is required (1=normal, 4=cyclic)'
        }
      });
    }

    // Validate fingerprint type
    if (fingerprintType !== 1 && fingerprintType !== 4) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FINGERPRINT_TYPE',
          message: 'Fingerprint type must be 1 (normal) or 4 (cyclic)'
        }
      });
    }

    console.log('➕ TTLock Add Fingerprint');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint Number:', fingerprintNumber);
    console.log('   Type:', getFingerprintTypeText(fingerprintType));
    if (fingerprintName) console.log('   Name:', fingerprintName);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      fingerprintNumber: fingerprintNumber,
      fingerprintType: fingerprintType,
      date: Date.now()
    };

    // Add optional parameters
    if (fingerprintName) params.fingerprintName = fingerprintName;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    console.log('📡 Calling TTLock Add Fingerprint API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/add`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock add fingerprint error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add fingerprint';
      let errorCode = 'ADD_FINGERPRINT_FAILED';

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
        errorMessage = 'Fingerprint number already exists';
        errorCode = 'FINGERPRINT_ALREADY_EXISTS';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can add fingerprints';
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

    const { fingerprintId } = response.data;

    console.log('✅ Fingerprint added successfully');
    console.log('   Fingerprint ID:', fingerprintId);

    // Return response
    res.json({
      success: true,
      message: 'Fingerprint added successfully',
      data: {
        fingerprintId: fingerprintId,
        lockId: lockId,
        fingerprintNumber: fingerprintNumber,
        fingerprintType: fingerprintType,
        fingerprintTypeText: getFingerprintTypeText(fingerprintType),
        fingerprintName: fingerprintName || null,
        startDate: startDate || null,
        endDate: endDate || null,
        cyclicConfig: cyclicConfig || null,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Add fingerprint error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to add fingerprint',
        details: error.message
      }
    });
  }
};

/**
 * Delete Fingerprint
 * Call this API after a fingerprint has been deleted from the lock
 * Endpoint: POST /v3/fingerprint/delete
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.fingerprintId - Fingerprint ID
 * @param {number} req.body.deleteType - Delete type: 1=bluetooth, 2=gateway, 3=NB-IoT (optional, default 1)
 * @returns {Object} Response confirming deletion
 */
export const deleteFingerprint = async (req, res) => {
  try {
    const { accessToken, lockId, fingerprintId, deleteType } = req.body;

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

    if (!fingerprintId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FINGERPRINT_ID',
          message: 'Fingerprint ID is required'
        }
      });
    }

    console.log('🗑️ TTLock Delete Fingerprint');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint ID:', fingerprintId);
    if (deleteType) console.log('   Delete Type:', getDeleteTypeText(deleteType));

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      fingerprintId: fingerprintId,
      date: Date.now()
    };

    // Add optional deleteType
    if (deleteType) {
      params.deleteType = deleteType;
    }

    console.log('📡 Calling TTLock Delete Fingerprint API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/delete`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete fingerprint error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete fingerprint';
      let errorCode = 'DELETE_FINGERPRINT_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3007) {
        errorMessage = 'Fingerprint not found';
        errorCode = 'FINGERPRINT_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can delete fingerprints';
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

    console.log('✅ Fingerprint deleted successfully');

    // Return response
    res.json({
      success: true,
      message: 'Fingerprint deleted successfully',
      data: {
        lockId: lockId,
        fingerprintId: fingerprintId,
        deleteType: deleteType || 1,
        deleteTypeText: getDeleteTypeText(deleteType || 1),
        deletedAt: new Date().toISOString(),
        warning: 'This fingerprint has been permanently removed from the lock'
      }
    });
  } catch (error) {
    console.error('❌ Delete fingerprint error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete fingerprint',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert delete type code to text
 * @param {number} type - Delete type code
 * @returns {string} Delete type text
 */
function getDeleteTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth',
    2: 'Gateway',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}

/**
 * Clear Fingerprints
 * Call this API after fingerprints have been cleared from the lock
 * Endpoint: POST /v3/fingerprint/clear
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @returns {Object} Response confirming all fingerprints cleared
 */
export const clearFingerprints = async (req, res) => {
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

    console.log('🗑️ TTLock Clear All Fingerprints');
    console.log('   Lock ID:', lockId);
    console.log('   ⚠️  WARNING: This will clear ALL fingerprints from the lock!');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear Fingerprints API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/clear`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock clear fingerprints error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to clear fingerprints';
      let errorCode = 'CLEAR_FINGERPRINTS_FAILED';

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
        errorMessage = 'Not lock admin - only the lock admin can clear fingerprints';
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

    console.log('✅ All fingerprints cleared successfully');

    // Return response
    res.json({
      success: true,
      message: 'All fingerprints cleared successfully',
      data: {
        lockId: lockId,
        clearedAt: new Date().toISOString(),
        warning: 'All fingerprints have been permanently removed from this lock'
      }
    });
  } catch (error) {
    console.error('❌ Clear fingerprints error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to clear fingerprints',
        details: error.message
      }
    });
  }
};

/**
 * Change Fingerprint Period
 * Change the period of validity of fingerprint via gateway or bluetooth
 * Endpoint: POST /v3/fingerprint/changePeriod
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.fingerprintId - Fingerprint ID
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {Array} req.body.cyclicConfig - Cyclic time configuration (optional)
 * @param {number} req.body.changeType - Change method: 1=bluetooth, 2=gateway, 3=NB-IoT (optional, default 1)
 * @returns {Object} Response confirming period change
 */
export const changeFingerprintPeriod = async (req, res) => {
  try {
    const { accessToken, lockId, fingerprintId, startDate, endDate, cyclicConfig, changeType } = req.body;

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

    if (!fingerprintId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FINGERPRINT_ID',
          message: 'Fingerprint ID is required'
        }
      });
    }

    console.log('📅 TTLock Change Fingerprint Period');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint ID:', fingerprintId);
    if (changeType) console.log('   Change Type:', getChangeTypeText(changeType));

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      fingerprintId: fingerprintId,
      date: Date.now()
    };

    // Add optional parameters
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);
    if (changeType) params.changeType = changeType;

    console.log('📡 Calling TTLock Change Fingerprint Period API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/changePeriod`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock change fingerprint period error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to change fingerprint period';
      let errorCode = 'CHANGE_PERIOD_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -1023) {
        errorMessage = 'Fingerprint does not exist';
        errorCode = 'FINGERPRINT_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3007) {
        errorMessage = 'Fingerprint not found';
        errorCode = 'FINGERPRINT_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can change fingerprint periods';
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

    console.log('✅ Fingerprint period changed successfully');

    // Return response
    res.json({
      success: true,
      message: 'Fingerprint period changed successfully',
      data: {
        lockId: lockId,
        fingerprintId: fingerprintId,
        startDate: startDate || null,
        endDate: endDate || null,
        cyclicConfig: cyclicConfig || null,
        changeType: changeType || 1,
        changeTypeText: getChangeTypeText(changeType || 1),
        changedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Change fingerprint period error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to change fingerprint period',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert change type code to text
 * @param {number} type - Change type code
 * @returns {string} Change type text
 */
function getChangeTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth',
    2: 'Gateway',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}
