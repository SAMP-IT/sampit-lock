import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get QR Code List
 * Get all QR codes of a lock with pagination
 * Endpoint: POST /v3/qrCode/list
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.pageNo - Page number (start from 1)
 * @param {number} req.body.pageSize - Items per page (default 20, max 100)
 * @returns {Object} Response with list of QR codes
 */
export const getQRCodeList = async (req, res) => {
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

    console.log('=� TTLock Get QR Code List');
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

    console.log('=� Calling TTLock Get QR Code List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/list`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock get QR code list error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get QR code list';
      let errorCode = 'GET_QR_CODE_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock does not support QR code function';
        errorCode = 'QR_CODE_NOT_SUPPORTED';
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

    console.log(' QR code list retrieved successfully');
    console.log('   Total QR Codes:', total);
    console.log('   Current Page:', currentPage);
    console.log('   Total Pages:', pages);

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'QR code list retrieved successfully',
      data: {
        lockId: lockId,
        qrCodes: list.map(qrCode => ({
          qrCodeId: qrCode.qrCodeId,
          lockId: qrCode.lockId,
          qrCodeNumber: qrCode.qrCodeNumber,
          name: qrCode.name,
          type: qrCode.type,
          typeText: getQRCodeTypeText(qrCode.type),
          startDate: qrCode.startDate,
          endDate: qrCode.endDate,
          cyclicConfig: qrCode.cyclicConfig,
          createDate: qrCode.createDate,
          status: qrCode.status,
          statusText: getQRCodeStatusText(qrCode.status),
          creator: qrCode.creator,
          isPeriod: qrCode.type === 1,
          isPermanent: qrCode.type === 2,
          isCyclic: qrCode.type === 4,
          isNormal: qrCode.status === 1,
          isExpired: qrCode.status === 2,
          isPending: qrCode.status === 3
        })),
        pagination: {
          pageNo: currentPage,
          pageSize: currentPageSize,
          totalPages: pages,
          totalQRCodes: total,
          hasNextPage: currentPage < pages,
          hasPreviousPage: currentPage > 1
        }
      }
    });
  } catch (error) {
    console.error('L Get QR code list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get QR code list',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert QR code type code to text
 * @param {number} type - QR code type code
 * @returns {string} QR code type text
 */
function getQRCodeTypeText(type) {
  const typeMap = {
    1: 'Period',
    2: 'Permanent',
    4: 'Cyclic'
  };
  return typeMap[type] || 'Unknown';
}

/**
 * Helper function to convert status code to text
 * @param {number} status - Status code
 * @returns {string} Status text
 */
function getQRCodeStatusText(status) {
  const statusMap = {
    1: 'Normal',
    2: 'Invalid or Expired',
    3: 'Pending'
  };
  return statusMap[status] || 'Unknown';
}

/**
 * Add QR Code
 * Create a QR code in the cloud server
 * Endpoint: POST /v3/qrCode/add
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {string} req.body.name - QR code name (optional)
 * @param {number} req.body.type - QR code type: 1=period, 2=permanent, 4=cyclic
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {Array} req.body.cyclicConfig - Cyclic time configuration (optional)
 * @returns {Object} Response with QR code ID, number, and link
 */
export const addQRCode = async (req, res) => {
  try {
    const { accessToken, lockId, name, type, startDate, endDate, cyclicConfig } = req.body;

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

    if (!type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TYPE',
          message: 'QR code type is required (1=period, 2=permanent, 4=cyclic)'
        }
      });
    }

    // Validate type
    if (type !== 1 && type !== 2 && type !== 4) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'QR code type must be 1 (period), 2 (permanent), or 4 (cyclic)'
        }
      });
    }

    console.log('� TTLock Add QR Code');
    console.log('   Lock ID:', lockId);
    console.log('   Type:', getQRCodeTypeText(type));
    if (name) console.log('   Name:', name);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      type: type,
      date: Date.now()
    };

    // Add optional parameters
    if (name) params.name = name;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    console.log('=� Calling TTLock Add QR Code API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/add`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock add QR code error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add QR code';
      let errorCode = 'ADD_QR_CODE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock does not support QR code function';
        errorCode = 'QR_CODE_NOT_SUPPORTED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can add QR codes';
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

    const { qrCodeId, qrCodeNumber, link } = response.data;

    console.log(' QR code added successfully');
    console.log('   QR Code ID:', qrCodeId);
    console.log('   Link:', link);

    // Return response
    res.json({
      success: true,
      message: 'QR code added successfully',
      data: {
        qrCodeId: qrCodeId,
        qrCodeNumber: qrCodeNumber,
        link: link,
        lockId: lockId,
        name: name || null,
        type: type,
        typeText: getQRCodeTypeText(type),
        startDate: startDate || null,
        endDate: endDate || null,
        cyclicConfig: cyclicConfig || null,
        createdAt: new Date().toISOString(),
        linkValidFor: '10 minutes'
      }
    });
  } catch (error) {
    console.error('L Add QR code error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to add QR code',
        details: error.message
      }
    });
  }
};

/**
 * Get QR Code Data
 * Get the detail of a QR code including qrCodeContent for generating QR code images
 * Endpoint: POST /v3/qrCode/getData
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.qrCodeId - QR code ID
 * @returns {Object} Response with QR code details and content for generating QR image
 */
export const getQRCodeData = async (req, res) => {
  try {
    const { accessToken, qrCodeId } = req.body;

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

    if (!qrCodeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QR_CODE_ID',
          message: 'QR code ID is required'
        }
      });
    }

    console.log('📊 TTLock Get QR Code Data');
    console.log('   QR Code ID:', qrCodeId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      qrCodeId: qrCodeId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get QR Code Data API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/getData`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get QR code data error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get QR code data';
      let errorCode = 'GET_QR_CODE_DATA_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - QR code ID may be invalid';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'QR code not found';
        errorCode = 'QR_CODE_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this QR code';
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

    const { lockAlias, type, qrCodeNumber, qrCodeContent, name, startDate, endDate, cyclicConfig, status } = response.data;

    console.log('✅ QR code data retrieved successfully');
    console.log('   QR Code Number:', qrCodeNumber);
    console.log('   Status:', getQRCodeStatusText(status));
    if (qrCodeContent) {
      console.log('   QR Code Content:', qrCodeContent.substring(0, 50) + '...');
    } else {
      console.log('   QR Code Content: Not available (QR code not in valid period)');
    }

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'QR code data retrieved successfully',
      data: {
        qrCodeId: qrCodeId,
        lockAlias: lockAlias,
        qrCodeNumber: qrCodeNumber,
        qrCodeContent: qrCodeContent || null,
        name: name,
        type: type,
        typeText: getQRCodeTypeText(type),
        startDate: startDate,
        endDate: endDate,
        cyclicConfig: cyclicConfig,
        status: status,
        statusText: getQRCodeStatusText(status),
        isPeriod: type === 1,
        isPermanent: type === 2,
        isCyclic: type === 4,
        isNormal: status === 1,
        isExpired: status === 2,
        isPending: status === 3,
        hasQRContent: !!qrCodeContent,
        contentAvailableNote: qrCodeContent
          ? 'QR code content is available and can be used to generate QR code image'
          : 'QR code content not available - QR code is not in valid period'
      }
    });
  } catch (error) {
    console.error('❌ Get QR code data error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get QR code data',
        details: error.message
      }
    });
  }
};

/**
 * Delete QR Code
 * Delete the QR code from the cloud server
 * Note: The generated QR code is still valid in valid period (10 minutes)
 * Endpoint: POST /v3/qrCode/delete
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.qrCodeId - QR code ID
 * @returns {Object} Response confirming deletion
 */
export const deleteQRCode = async (req, res) => {
  try {
    const { accessToken, lockId, qrCodeId } = req.body;

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

    if (!qrCodeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QR_CODE_ID',
          message: 'QR code ID is required'
        }
      });
    }

    console.log('🗑️  TTLock Delete QR Code');
    console.log('   Lock ID:', lockId);
    console.log('   QR Code ID:', qrCodeId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      qrCodeId: qrCodeId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete QR Code API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/delete`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete QR code error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete QR code';
      let errorCode = 'DELETE_QR_CODE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'QR code not found';
        errorCode = 'QR_CODE_NOT_FOUND';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can delete QR codes';
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

    console.log('✅ QR code deleted successfully');

    // Return response
    res.json({
      success: true,
      message: 'QR code deleted successfully',
      data: {
        lockId: lockId,
        qrCodeId: qrCodeId,
        deletedAt: new Date().toISOString(),
        note: 'The H5 link is now invalid and QR code data cannot be refreshed. However, any generated QR code is still valid for its remaining validity period (up to 10 minutes).'
      }
    });
  } catch (error) {
    console.error('❌ Delete QR code error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete QR code',
        details: error.message
      }
    });
  }
};

/**
 * Clear QR Codes
 * Clear all QR codes from a lock
 * Endpoint: POST /v3/qrCode/clear
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @returns {Object} Response confirming all QR codes cleared
 */
export const clearQRCodes = async (req, res) => {
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

    console.log('🗑️  TTLock Clear All QR Codes');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear QR Codes API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/clear`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock clear QR codes error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to clear QR codes';
      let errorCode = 'CLEAR_QR_CODES_FAILED';

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
        errorMessage = 'Not lock admin - only the lock admin can clear QR codes';
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

    console.log('✅ All QR codes cleared successfully');

    // Return response
    res.json({
      success: true,
      message: 'All QR codes cleared successfully',
      data: {
        lockId: lockId,
        clearedAt: new Date().toISOString(),
        warning: 'All QR codes have been permanently removed from this lock. This action cannot be undone.'
      }
    });
  } catch (error) {
    console.error('❌ Clear QR codes error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to clear QR codes',
        details: error.message
      }
    });
  }
};

/**
 * Update QR Code
 * Update the name, valid period, and cyclic configuration of a QR code
 * Note: QR code type cannot be changed
 * Endpoint: POST /v3/qrCode/update
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.qrCodeId - QR code ID
 * @param {string} req.body.name - QR code name (optional)
 * @param {number} req.body.startDate - Start time timestamp in milliseconds (optional)
 * @param {number} req.body.endDate - End time timestamp in milliseconds (optional)
 * @param {Array} req.body.cyclicConfig - Cyclic time configuration (optional)
 * @returns {Object} Response confirming update
 */
export const updateQRCode = async (req, res) => {
  try {
    const { accessToken, qrCodeId, name, startDate, endDate, cyclicConfig } = req.body;

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

    if (!qrCodeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QR_CODE_ID',
          message: 'QR code ID is required'
        }
      });
    }

    // Validate that at least one field to update is provided
    if (!name && !startDate && !endDate && !cyclicConfig) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UPDATE_FIELDS',
          message: 'At least one field to update is required (name, startDate, endDate, or cyclicConfig)'
        }
      });
    }

    console.log('✏️  TTLock Update QR Code');
    console.log('   QR Code ID:', qrCodeId);
    if (name) console.log('   New Name:', name);
    if (startDate) console.log('   New Start Date:', new Date(startDate).toISOString());
    if (endDate) console.log('   New End Date:', new Date(endDate).toISOString());

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      qrCodeId: qrCodeId,
      date: Date.now()
    };

    // Add optional parameters
    if (name) params.name = name;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    console.log('📡 Calling TTLock Update QR Code API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/update`,
      null,
      { params }
    );

    console.log('📡 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock update QR code error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to update QR code';
      let errorCode = 'UPDATE_QR_CODE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check QR code ID and update values';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -1009) {
        errorMessage = 'QR code not found';
        errorCode = 'QR_CODE_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this QR code';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only the lock admin can update QR codes';
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

    console.log('✅ QR code updated successfully');

    // Return response with updated fields
    res.json({
      success: true,
      message: 'QR code updated successfully',
      data: {
        qrCodeId: qrCodeId,
        updatedFields: {
          name: name || null,
          startDate: startDate || null,
          endDate: endDate || null,
          cyclicConfig: cyclicConfig || null
        },
        updatedAt: new Date().toISOString(),
        note: 'QR code type cannot be changed. To change the type, delete and create a new QR code.'
      }
    });
  } catch (error) {
    console.error('❌ Update QR code error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to update QR code',
        details: error.message
      }
    });
  }
};
