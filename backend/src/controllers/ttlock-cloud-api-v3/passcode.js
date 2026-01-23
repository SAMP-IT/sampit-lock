import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Get a passcode (Create/Retrieve passcode)
 * @route POST /api/ttlock-v3/passcode/get
 */
export const getPasscode = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyboardPwdVersion,
      keyboardPwdType,
      keyboardPwdName,
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

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!keyboardPwdVersion) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYBOARD_PWD_VERSION',
          message: 'Passcode version is required (typically 4 for latest locks)'
        }
      });
    }

    if (!keyboardPwdType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYBOARD_PWD_TYPE',
          message: 'Passcode type is required (1-14)'
        }
      });
    }

    // For one-time passcodes (type 1), ensure dates are rounded to hours
    let processedStartDate = startDate ? parseInt(startDate) : Date.now();
    let processedEndDate = endDate ? parseInt(endDate) : null;
    
    if (keyboardPwdType === 1) {
      // IMPORTANT: TTLock API requires valid time to be defined in HOUR
      // with minute and second set to 0
      const startDateObj = new Date(processedStartDate);
      startDateObj.setMinutes(0);
      startDateObj.setSeconds(0);
      startDateObj.setMilliseconds(0);
      processedStartDate = startDateObj.getTime();
      
      // If endDate not provided, set to 6 hours later
      if (!processedEndDate) {
        processedEndDate = processedStartDate + (6 * 60 * 60 * 1000);
      }
      
      // Round end date to hour
      const endDateObj = new Date(processedEndDate);
      endDateObj.setMinutes(0);
      endDateObj.setSeconds(0);
      endDateObj.setMilliseconds(0);
      processedEndDate = endDateObj.getTime();
      
      console.log(`📋 One-time passcode date processing:`, {
        originalStart: startDate ? new Date(parseInt(startDate)).toISOString() : 'now',
        processedStart: new Date(processedStartDate).toISOString(),
        originalEnd: endDate ? new Date(parseInt(endDate)).toISOString() : 'calculated',
        processedEnd: new Date(processedEndDate).toISOString(),
        durationHours: (processedEndDate - processedStartDate) / (60 * 60 * 1000)
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyboardPwdVersion: parseInt(keyboardPwdVersion),
      keyboardPwdType: parseInt(keyboardPwdType),
      date: Date.now()
    };

    // Add optional parameters
    if (keyboardPwdName) {
      params.keyboardPwdName = keyboardPwdName;
    }
    if (processedStartDate) {
      params.startDate = processedStartDate;
    }
    if (processedEndDate) {
      params.endDate = processedEndDate;
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/get`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get passcode';
      let errorCode = 'GET_PASSCODE_FAILED';

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
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3007) {
        errorMessage = 'Invalid passcode type';
        errorCode = 'INVALID_PASSCODE_TYPE';
      } else if (response.data.errcode === -3010) {
        errorMessage = 'Invalid time period';
        errorCode = 'INVALID_TIME_PERIOD';
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

    // Extract passcode data from response
    const { keyboardPwd, keyboardPwdId } = response.data;

    // Map passcode type to description
    const passcodeTypeMap = {
      1: 'One-time (valid for once within 6 hours)',
      2: 'Permanent (must be used within 24 hours after start)',
      3: 'Period (must be used within 24 hours after start)',
      4: 'Delete (deletes all other codes)',
      5: 'Weekend Cyclic',
      6: 'Daily Cyclic',
      7: 'Workday Cyclic',
      8: 'Monday Cyclic',
      9: 'Tuesday Cyclic',
      10: 'Wednesday Cyclic',
      11: 'Thursday Cyclic',
      12: 'Friday Cyclic',
      13: 'Saturday Cyclic',
      14: 'Sunday Cyclic'
    };

    const passcodeTypeDescription = passcodeTypeMap[keyboardPwdType] || 'Unknown type';

    // Calculate expiration info for one-time passcodes
    let expirationInfo = null;
    if (keyboardPwdType === 1 && processedEndDate) {
      const now = new Date();
      const expiry = new Date(processedEndDate);
      const diff = expiry - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      expirationInfo = {
        expires_in_hours: hours,
        expires_in_minutes: minutes,
        expires_in_text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        is_one_time: true,
        works_once: true
      };
    }

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Passcode retrieved successfully',
      data: {
        passcode: keyboardPwd,
        passcodeId: keyboardPwdId,
        lockId: parseInt(lockId),
        type: parseInt(keyboardPwdType),
        typeDescription: passcodeTypeDescription,
        name: keyboardPwdName || 'Unnamed',
        version: parseInt(keyboardPwdVersion),
        createdAt: new Date().toISOString(),
        validity: processedStartDate && processedEndDate ? {
          startDate: new Date(processedStartDate).toISOString(),
          endDate: new Date(processedEndDate).toISOString(),
          startTimestamp: processedStartDate,
          endTimestamp: processedEndDate
        } : 'No time restriction specified',
        expiration_info: expirationInfo,
        notes: [
          'Passcode created successfully',
          'Share this passcode with the user',
          'Passcode can be used to unlock the lock',
          'For V4 locks, passcode can be deleted via Bluetooth or gateway',
          'Save passcodeId for future management operations'
        ],
        passcodeTypes: {
          oneTime: {
            type: 1,
            description: 'Valid for once within 6 hours from Start Time',
            usage: 'Single-use passcode with short validity',
            example: 'Guest access for delivery or service'
          },
          permanent: {
            type: 2,
            description: 'Must be used at least once within 24 hours after Start Time',
            usage: 'Long-term passcode without expiration',
            example: 'Permanent resident or staff access'
          },
          period: {
            type: 3,
            description: 'Must be used at least once within 24 hours after Start Time',
            usage: 'Time-limited passcode with specific validity period',
            example: 'Guest access for specific dates'
          },
          delete: {
            type: 4,
            description: 'Deletes all other codes',
            usage: 'Emergency passcode to clear all access',
            warning: 'Use with caution - removes all other passcodes!'
          },
          cyclic: {
            types: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            description: 'Valid during specific time periods on recurring days',
            usage: 'Recurring access patterns',
            examples: [
              'Cleaning service every weekday',
              'Weekend guest access',
              'Daily maintenance windows'
            ]
          }
        },
        importantNotes: [
          'Valid time should be defined in HOUR (set minute and second to 0)',
          'If validity period is longer than one year, end time should be XX months later',
          'One-time passcodes are valid for once within 6 hours',
          'Permanent and Period passcodes must be used within 24 hours after start',
          'Delete passcode (type 4) will remove ALL other passcodes - use with caution',
          'Cyclic passcodes (types 5-14) are valid during specific recurring time periods',
          'Passcode version 4 is for latest locks',
          'Save the passcodeId for future deletion or management'
        ],
        useCases: [
          'Provide temporary access to guests or service providers',
          'Create permanent access codes for residents or staff',
          'Set up recurring access for cleaning or maintenance',
          'Emergency access with delete code to clear all passcodes',
          'Time-limited access for short-term rentals'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Get passcode error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to get passcode';
      let errorCode = 'GET_PASSCODE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (error.response.data.errcode === -3007) {
        errorMessage = 'Invalid passcode type';
        errorCode = 'INVALID_PASSCODE_TYPE';
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
        message: 'Internal server error while getting passcode',
        details: error.message
      }
    });
  }
};

/**
 * Delete one passcode
 * @route POST /api/ttlock-v3/passcode/delete
 */
export const deletePasscode = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyboardPwdId,
      deleteType
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

    if (!keyboardPwdId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYBOARD_PWD_ID',
          message: 'Passcode ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyboardPwdId: parseInt(keyboardPwdId),
      date: Date.now()
    };

    // Add optional deleteType parameter
    if (deleteType) {
      params.deleteType = parseInt(deleteType);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/delete`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete passcode';
      let errorCode = 'DELETE_PASSCODE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check lock ID and passcode ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3008) {
        errorMessage = 'Passcode not found';
        errorCode = 'PASSCODE_NOT_FOUND';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Passcode already deleted';
        errorCode = 'PASSCODE_ALREADY_DELETED';
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

    // Map delete type to description
    const deleteTypeMap = {
      1: 'Delete via App via Bluetooth (requires Bluetooth deletion first)',
      2: 'Delete via WiFi gateway (direct cloud deletion)',
      3: 'Delete via NB-IoT (direct cloud deletion)'
    };

    const deleteTypeDescription = deleteTypeMap[deleteType] || 'Delete via App via Bluetooth (default)';

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Passcode deleted successfully',
      data: {
        lockId: parseInt(lockId),
        passcodeId: parseInt(keyboardPwdId),
        deleteType: deleteType ? parseInt(deleteType) : 1,
        deleteMethod: deleteTypeDescription,
        deletedAt: new Date().toISOString(),
        notes: [
          'Passcode has been deleted from the lock',
          'User can no longer unlock with this passcode',
          'Only V4 passcode locks support deletion via Bluetooth or gateway',
          'For deleteType=1, you must delete via Bluetooth first before calling this API',
          'For deleteType=2 or 3, deletion happens directly via cloud'
        ],
        deleteTypes: {
          bluetooth: {
            type: 1,
            description: 'Delete with App via Bluetooth',
            requirement: 'Must delete via Bluetooth first, then call this API',
            usage: 'When you have physical Bluetooth access to the lock'
          },
          wifiGateway: {
            type: 2,
            description: 'Delete via WiFi gateway',
            requirement: 'Direct cloud deletion, no Bluetooth needed',
            usage: 'When lock is connected to WiFi gateway'
          },
          nbIot: {
            type: 3,
            description: 'Delete via NB-IoT',
            requirement: 'Direct cloud deletion, no Bluetooth needed',
            usage: 'When lock has NB-IoT connectivity'
          }
        },
        whatHappened: {
          passcodeDeleted: true,
          userAccess: 'User can no longer unlock with this passcode',
          lockFunctionality: 'Not affected - lock works normally',
          otherPasscodes: 'Not affected - other passcodes still work',
          reversal: 'Cannot be undone - need to create new passcode'
        },
        importantNotes: [
          'Passcode deletion is PERMANENT and cannot be undone',
          'Only locks with V4 passcode support deletion',
          'Delete type determines the deletion method',
          'Type 1 requires Bluetooth deletion first',
          'Type 2 and 3 allow direct cloud deletion',
          'User loses access immediately upon deletion',
          'Create a new passcode if access needs to be restored'
        ],
        useCases: [
          'Revoke temporary access after guest checkout',
          'Remove service provider access after job completion',
          'Delete compromised or leaked passcodes',
          'Clean up expired or unused passcodes',
          'Remove access for terminated employees or residents'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Delete passcode error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to delete passcode';
      let errorCode = 'DELETE_PASSCODE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (error.response.data.errcode === -3008) {
        errorMessage = 'Passcode not found';
        errorCode = 'PASSCODE_NOT_FOUND';
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
        message: 'Internal server error while deleting passcode',
        details: error.message
      }
    });
  }
};

/**
 * Change passcode
 * @route POST /api/ttlock-v3/passcode/change
 */
export const changePasscode = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyboardPwdId,
      keyboardPwdName,
      newKeyboardPwd,
      startDate,
      endDate,
      changeType
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

    if (!keyboardPwdId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYBOARD_PWD_ID',
          message: 'Passcode ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyboardPwdId: parseInt(keyboardPwdId),
      date: Date.now()
    };

    // Add optional parameters
    if (keyboardPwdName) {
      params.keyboardPwdName = keyboardPwdName;
    }
    if (newKeyboardPwd) {
      params.newKeyboardPwd = newKeyboardPwd;
    }
    if (startDate) {
      params.startDate = parseInt(startDate);
    }
    if (endDate) {
      params.endDate = parseInt(endDate);
    }
    if (changeType) {
      params.changeType = parseInt(changeType);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/change`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to change passcode';
      let errorCode = 'CHANGE_PASSCODE_FAILED';

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
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3008) {
        errorMessage = 'Passcode not found';
        errorCode = 'PASSCODE_NOT_FOUND';
      } else if (response.data.errcode === -3010) {
        errorMessage = 'Invalid time period';
        errorCode = 'INVALID_TIME_PERIOD';
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

    // Map change type to description
    const changeTypeMap = {
      1: 'Via phone Bluetooth (requires SDK method call first)',
      2: 'Via WiFi gateway (direct cloud change)',
      3: 'Via NB-IoT (direct cloud change)'
    };

    const changeTypeDescription = changeTypeMap[changeType] || 'Via phone Bluetooth (default)';

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Passcode changed successfully',
      data: {
        lockId: parseInt(lockId),
        passcodeId: parseInt(keyboardPwdId),
        changeType: changeType ? parseInt(changeType) : 1,
        changeMethod: changeTypeDescription,
        changedAt: new Date().toISOString(),
        changes: {
          newName: keyboardPwdName || 'Not changed',
          newPasscode: newKeyboardPwd ? 'Changed (new passcode set)' : 'Not changed',
          newStartDate: startDate ? new Date(parseInt(startDate)).toISOString() : 'Not changed',
          newEndDate: endDate ? new Date(parseInt(endDate)).toISOString() : 'Not changed'
        },
        notes: [
          'Passcode has been updated successfully',
          'User should use the new passcode if it was changed',
          'Only V4 passcode locks support passcode changes',
          'For changeType=1, SDK method must be called first',
          'For changeType=2 or 3, change happens directly via cloud'
        ],
        changeTypes: {
          bluetooth: {
            type: 1,
            description: 'Via phone Bluetooth',
            requirement: 'Must call SDK method first, then call this API',
            usage: 'When you have physical Bluetooth access to the lock'
          },
          wifiGateway: {
            type: 2,
            description: 'Via WiFi gateway',
            requirement: 'Direct cloud change, no Bluetooth needed',
            usage: 'When lock is connected to WiFi gateway'
          },
          nbIot: {
            type: 3,
            description: 'Via NB-IoT',
            requirement: 'Direct cloud change, no Bluetooth needed',
            usage: 'When lock has NB-IoT connectivity'
          }
        },
        whatChanged: {
          passcodeModified: true,
          oldPasscodeInvalid: newKeyboardPwd ? true : false,
          lockFunctionality: 'Not affected - lock works normally',
          userAccess: newKeyboardPwd ? 'User must use new passcode' : 'User can still use old passcode'
        },
        importantNotes: [
          'Only locks with V4 passcode support passcode changes',
          'Change type determines the modification method',
          'Type 1 requires Bluetooth SDK call first',
          'Type 2 and 3 allow direct cloud changes',
          'If newKeyboardPwd is provided, old passcode becomes invalid',
          'User must be informed of the new passcode',
          'Name, validity period, or passcode value can be changed'
        ],
        useCases: [
          'Update passcode for security after potential leak',
          'Change passcode name for better organization',
          'Extend or reduce validity period',
          'Replace compromised passcode with new one',
          'Update temporary passcode to different dates'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Change passcode error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to change passcode';
      let errorCode = 'CHANGE_PASSCODE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (error.response.data.errcode === -3008) {
        errorMessage = 'Passcode not found';
        errorCode = 'PASSCODE_NOT_FOUND';
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
        message: 'Internal server error while changing passcode',
        details: error.message
      }
    });
  }
};

/**
 * Add a passcode
 * @route POST /api/ttlock-v3/passcode/add
 */
export const addPasscode = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
      keyboardPwd,
      keyboardPwdName,
      startDate,
      endDate,
      addType
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

    if (!keyboardPwd) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_KEYBOARD_PWD',
          message: 'Passcode is required (your custom passcode)'
        }
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_START_DATE',
          message: 'Start date is required'
        }
      });
    }

    if (!endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_END_DATE',
          message: 'End date is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      keyboardPwd: keyboardPwd,
      startDate: parseInt(startDate),
      endDate: parseInt(endDate),
      date: Date.now()
    };

    // Add optional parameters
    if (keyboardPwdName) {
      params.keyboardPwdName = keyboardPwdName;
    }
    if (addType) {
      params.addType = parseInt(addType);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/add`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add passcode';
      let errorCode = 'ADD_PASSCODE_FAILED';

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
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3010) {
        errorMessage = 'Invalid time period';
        errorCode = 'INVALID_TIME_PERIOD';
      } else if (response.data.errcode === -3011) {
        errorMessage = 'Passcode already exists';
        errorCode = 'PASSCODE_EXISTS';
      } else if (response.data.errcode === -3012) {
        errorMessage = 'Invalid passcode format';
        errorCode = 'INVALID_PASSCODE_FORMAT';
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

    // Extract passcode ID from response
    const { keyboardPwdId } = response.data;

    // Map add type to description
    const addTypeMap = {
      1: 'Via phone Bluetooth (requires SDK method call first)',
      2: 'Via WiFi gateway (direct cloud addition)',
      3: 'Via NB-IoT (direct cloud addition)'
    };

    const addTypeDescription = addTypeMap[addType] || 'Via phone Bluetooth (default)';

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Custom passcode added successfully',
      data: {
        passcode: keyboardPwd,
        passcodeId: keyboardPwdId,
        lockId: parseInt(lockId),
        name: keyboardPwdName || 'Unnamed',
        addType: addType ? parseInt(addType) : 1,
        addMethod: addTypeDescription,
        createdAt: new Date().toISOString(),
        validity: {
          startDate: new Date(parseInt(startDate)).toISOString(),
          endDate: new Date(parseInt(endDate)).toISOString(),
          startTimestamp: parseInt(startDate),
          endTimestamp: parseInt(endDate)
        },
        notes: [
          'Custom passcode added successfully',
          'User can use this specific passcode to unlock',
          'Only V4 passcode locks support custom passcode addition',
          'For addType=1, SDK method must be called first',
          'For addType=2 or 3, addition happens directly via cloud',
          'Save passcodeId for future management operations'
        ],
        addTypes: {
          bluetooth: {
            type: 1,
            description: 'Via phone Bluetooth',
            requirement: 'Must call SDK method first, then call this API',
            usage: 'When you have physical Bluetooth access to the lock'
          },
          wifiGateway: {
            type: 2,
            description: 'Via WiFi gateway',
            requirement: 'Direct cloud addition, no Bluetooth needed',
            usage: 'When lock is connected to WiFi gateway'
          },
          nbIot: {
            type: 3,
            description: 'Via NB-IoT',
            requirement: 'Direct cloud addition, no Bluetooth needed',
            usage: 'When lock has NB-IoT connectivity'
          }
        },
        whatIsThis: {
          customPasscode: true,
          difference: 'Unlike "get passcode", this lets you specify the exact passcode',
          benefit: 'User can choose memorable passcode instead of random one',
          requirement: 'Must specify passcode, start date, and end date',
          lockSupport: 'Only V4 passcode locks support this feature'
        },
        getVsAdd: {
          getPasscode: {
            method: 'System generates random passcode',
            control: 'No control over passcode value',
            usage: 'Quick passcode generation',
            types: 'Supports 14 passcode types (one-time, permanent, cyclic, etc.)'
          },
          addPasscode: {
            method: 'You specify custom passcode',
            control: 'Full control over passcode value',
            usage: 'Memorable or specific passcode needed',
            types: 'Period-based only (specify start and end dates)'
          }
        },
        importantNotes: [
          'Only locks with V4 passcode support custom passcode addition',
          'You must specify the exact passcode you want to add',
          'Passcode must meet lock requirements (length, format)',
          'Start date and end date are REQUIRED',
          'Add type determines the addition method',
          'Type 1 requires Bluetooth SDK call first',
          'Type 2 and 3 allow direct cloud addition',
          'Passcode cannot already exist on the lock'
        ],
        useCases: [
          'Add memorable passcode for elderly users',
          'Create easy-to-remember family passcode',
          'Set specific passcode required by organization',
          'Add temporary passcode with exact code needed',
          'Provide branded or themed passcode (e.g., 2025 for year)'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Add passcode error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to add passcode';
      let errorCode = 'ADD_PASSCODE_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (error.response.data.errcode === -3011) {
        errorMessage = 'Passcode already exists';
        errorCode = 'PASSCODE_EXISTS';
      } else if (error.response.data.errcode === -3012) {
        errorMessage = 'Invalid passcode format';
        errorCode = 'INVALID_PASSCODE_FORMAT';
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
        message: 'Internal server error while adding passcode',
        details: error.message
      }
    });
  }
};
