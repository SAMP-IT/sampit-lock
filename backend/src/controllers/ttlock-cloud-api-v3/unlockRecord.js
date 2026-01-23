import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get Unlock Records
 * Get unlock records of a lock with pagination and optional date filtering
 * Endpoint: POST /v3/lockRecord/list
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {number} req.body.startDate - Query start time (0 for no constraint) (optional)
 * @param {number} req.body.endDate - Query end time (0 for no constraint) (optional)
 * @param {number} req.body.pageNo - Page number (start from 1)
 * @param {number} req.body.pageSize - Items per page (default 20, max 100)
 * @returns {Object} Response with list of unlock records
 */
export const getUnlockRecords = async (req, res) => {
  try {
    const { accessToken, lockId, startDate, endDate, pageNo, pageSize } = req.body;

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

    console.log('=� TTLock Get Unlock Records');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo);
    console.log('   Page Size:', pageSize);
    if (startDate) console.log('   Start Date:', new Date(startDate).toISOString());
    if (endDate) console.log('   End Date:', new Date(endDate).toISOString());

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    // Add optional date filters
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    console.log('=� Calling TTLock Get Unlock Records API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lockRecord/list`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock get unlock records error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get unlock records';
      let errorCode = 'GET_UNLOCK_RECORDS_FAILED';

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

    console.log(' Unlock records retrieved successfully');
    console.log('   Total Records:', total);
    console.log('   Current Page:', currentPage);
    console.log('   Total Pages:', pages);

    // Return response with enhanced data
    res.json({
      success: true,
      message: 'Unlock records retrieved successfully',
      data: {
        lockId: lockId,
        records: list.map(record => ({
          lockId: record.lockId,
          recordType: record.recordType,
          recordTypeText: getRecordTypeText(record.recordType),
          success: record.success,
          successText: record.success === 1 ? 'Success' : 'Failed',
          username: record.username,
          keyboardPwd: record.keyboardPwd,
          lockDate: record.lockDate,
          lockDateFormatted: new Date(record.lockDate).toISOString(),
          serverDate: record.serverDate,
          serverDateFormatted: new Date(record.serverDate).toISOString(),
          isSuccessful: record.success === 1,
          isFailed: record.success === 0,
          isAppUnlock: record.recordType === 1,
          isGatewayUnlock: record.recordType === 3 || record.recordType === 12,
          isPasscodeUnlock: record.recordType === 4,
          isICCardUnlock: record.recordType === 7,
          isFingerprintUnlock: record.recordType === 8,
          isMechanicalKeyUnlock: record.recordType === 10,
          isSecurityAlert: record.recordType === 29 || record.recordType === 44 || record.recordType === 48
        })),
        pagination: {
          pageNo: currentPage,
          pageSize: currentPageSize,
          totalPages: pages,
          totalRecords: total,
          hasNextPage: currentPage < pages,
          hasPreviousPage: currentPage > 1
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          hasDateFilter: !!(startDate || endDate)
        }
      }
    });
  } catch (error) {
    console.error('L Get unlock records error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get unlock records',
        details: error.message
      }
    });
  }
};

/**
 * Helper function to convert record type code to text
 * @param {number} type - Record type code
 * @returns {string} Record type text
 */
function getRecordTypeText(type) {
  const typeMap = {
    1: 'App unlock',
    2: 'Touch parking lock',
    3: 'Gateway unlock',
    4: 'Passcode unlock',
    5: 'Parking lock raise',
    6: 'Parking lock lower',
    7: 'IC card unlock',
    8: 'Fingerprint unlock',
    9: 'Wristband unlock',
    10: 'Mechanical key unlock',
    11: 'Bluetooth lock',
    12: 'Gateway unlock',
    29: 'Unexpected unlock',
    30: 'Door magnet close',
    31: 'Door magnet open',
    32: 'Open from inside',
    33: 'Lock by fingerprint',
    34: 'Lock by passcode',
    35: 'Lock by IC card',
    36: 'Lock by mechanical key',
    37: 'Remote control',
    44: 'Tamper alert',
    45: 'Auto lock',
    46: 'Unlock by unlock key',
    47: 'Lock by lock key',
    48: 'Use INVALID passcode several times'
  };
  return typeMap[type] || 'Unknown';
}

/**
 * Upload Records
 * Upload records stored in lock (read from SDK)
 * Endpoint: POST /v3/lockRecord/upload
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.lockId - Lock ID
 * @param {string} req.body.records - Records stored in lock (from SDK)
 * @returns {Object} Response confirming upload
 */
export const uploadRecords = async (req, res) => {
  try {
    const { accessToken, lockId, records } = req.body;

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

    if (!records) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RECORDS',
          message: 'Records data is required'
        }
      });
    }

    console.log('=� TTLock Upload Records');
    console.log('   Lock ID:', lockId);
    console.log('   Records Length:', records.length);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      records: records,
      date: Date.now()
    };

    console.log('=� Calling TTLock Upload Records API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lockRecord/upload`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock upload records error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to upload records';
      let errorCode = 'UPLOAD_RECORDS_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 80002) {
        errorMessage = 'Invalid records format - records must be obtained from TTLock SDK';
        errorCode = 'INVALID_RECORDS_FORMAT';
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

    console.log(' Records uploaded successfully');

    // Return response
    res.json({
      success: true,
      message: 'Records uploaded successfully',
      data: {
        lockId: lockId,
        recordsLength: records.length,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('L Upload records error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to upload records',
        details: error.message
      }
    });
  }
};
