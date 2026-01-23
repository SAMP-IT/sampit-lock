import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Add Group
 * @route POST /api/ttlock-v3/group/add
 */
export const addGroup = async (req, res) => {
  try {
    const {
      accessToken,
      name
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

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'Group name is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      name,
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/add`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to add group';
      let errorCode = 'ADD_GROUP_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check group name';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3022) {
        errorMessage = 'Group name already exists';
        errorCode = 'GROUP_NAME_EXISTS';
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

    // Extract group ID from response
    const { groupId } = response.data;

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Group created successfully',
      data: {
        groupId,
        name,
        createdAt: new Date().toISOString(),
        notes: [
          'Group created successfully',
          'Use groupId to organize locks and ekeys',
          'Assign locks to this group during initialization',
          'Filter lock and ekey lists by groupId'
        ],
        whatIsGroup: {
          purpose: 'Organize and classify locks and ekeys',
          usage: 'Group locks by location, property, or category',
          benefits: [
            'Better organization of multiple locks',
            'Easier filtering and management',
            'Logical separation of locks and access'
          ]
        },
        howToUse: [
          'When initializing a lock, add groupId parameter to assign it to this group',
          'When getting lock list, filter by groupId to see only locks in this group',
          'When getting ekey list, filter by groupId to see only ekeys in this group',
          'Useful for managing properties, buildings, or different locations'
        ],
        useCases: [
          'Separate locks by building or floor',
          'Organize locks by property or location',
          'Group locks by access level',
          'Categorize locks by department or purpose',
          'Manage multiple properties or locations'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Add group error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to add group';
      let errorCode = 'ADD_GROUP_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -3022) {
        errorMessage = 'Group name already exists';
        errorCode = 'GROUP_NAME_EXISTS';
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
        message: 'Internal server error while adding group',
        details: error.message
      }
    });
  }
};

/**
 * Get the group list of an account
 * @route POST /api/ttlock-v3/group/list
 */
export const getGroupList = async (req, res) => {
  try {
    const {
      accessToken
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

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/list`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get group list';
      let errorCode = 'GET_GROUP_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
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

    // Extract group list from response
    const { list = [] } = response.data;

    // Enhanced response
    return res.status(200).json({
      success: true,
      message: 'Group list retrieved successfully',
      data: {
        groups: list,
        totalGroups: list.length,
        summary: {
          hasGroups: list.length > 0,
          groupCount: list.length,
          groupNames: list.map(g => g.name)
        },
        notes: [
          'Groups help organize and classify locks and ekeys',
          'Use groupId when initializing locks to assign them to groups',
          'Filter lock and ekey lists by groupId for better organization',
          'Empty list means no groups have been created yet'
        ],
        howToUseGroups: {
          assignLockToGroup: 'When initializing a lock, include groupId parameter',
          filterLocks: 'When getting lock list, add groupId parameter to filter',
          filterEkeys: 'When getting ekey list, add groupId parameter to filter',
          organize: 'Create groups for different locations, properties, or categories'
        }
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Get group list error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to get group list';
      let errorCode = 'GET_GROUP_LIST_FAILED';

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
        message: 'Internal server error while getting group list',
        details: error.message
      }
    });
  }
};

/**
 * Update Group
 * @route POST /api/ttlock-v3/group/update
 */
export const updateGroup = async (req, res) => {
  try {
    const {
      accessToken,
      groupId,
      name
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

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'New group name is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      groupId: parseInt(groupId),
      name,
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/update`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to update group';
      let errorCode = 'UPDATE_GROUP_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check group ID and name';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3022) {
        errorMessage = 'Group name already exists';
        errorCode = 'GROUP_NAME_EXISTS';
      } else if (response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
      message: 'Group updated successfully',
      data: {
        groupId: parseInt(groupId),
        newName: name,
        updatedAt: new Date().toISOString(),
        notes: [
          'Group name updated successfully',
          'All locks in this group remain assigned',
          'All ekeys in this group remain assigned',
          'The groupId remains the same, only the name changed'
        ],
        whatChanged: {
          groupId: parseInt(groupId),
          newName: name,
          unchanged: [
            'Group ID stays the same',
            'Lock assignments remain intact',
            'Ekey assignments remain intact',
            'Group configuration preserved'
          ]
        },
        importantNotes: [
          'Only the group name has changed',
          'GroupId remains the same for filtering and assignments',
          'No need to reassign locks or ekeys',
          'Users see the new name immediately',
          'New name must be unique (cannot duplicate existing group names)'
        ],
        useCases: [
          'Rename group for better organization',
          'Correct typos in group name',
          'Update naming convention',
          'Rebrand location or property names',
          'Standardize group naming across organization'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Update group error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to update group';
      let errorCode = 'UPDATE_GROUP_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -3022) {
        errorMessage = 'Group name already exists';
        errorCode = 'GROUP_NAME_EXISTS';
      } else if (error.response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
        message: 'Internal server error while updating group',
        details: error.message
      }
    });
  }
};

/**
 * Delete Group
 * @route POST /api/ttlock-v3/group/delete
 */
export const deleteGroup = async (req, res) => {
  try {
    const {
      accessToken,
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

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      groupId: parseInt(groupId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/delete`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete group';
      let errorCode = 'DELETE_GROUP_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check group ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
      message: 'Group deleted successfully',
      data: {
        groupId: parseInt(groupId),
        deletedAt: new Date().toISOString(),
        notes: [
          'Group has been permanently deleted',
          'All locks that were in this group now have NO group',
          'All ekeys that were in this group now have NO group',
          'Locks and ekeys still exist, just ungrouped',
          'You can reassign locks to other groups if needed'
        ],
        whatHappened: {
          groupDeleted: true,
          locksAffected: 'All locks in this group are now ungrouped',
          ekeysAffected: 'All ekeys in this group are now ungrouped',
          locksFunctionality: 'Locks still work normally',
          ekeysFunctionality: 'Ekeys still work normally',
          dataLoss: 'Only group organization is lost, not locks or access'
        },
        importantNotes: [
          'Group deletion is PERMANENT and cannot be undone',
          'Locks are NOT deleted, just ungrouped',
          'Ekeys are NOT deleted, just ungrouped',
          'Lock functionality is NOT affected',
          'Access permissions are NOT affected',
          'You can create a new group with the same name if needed',
          'Ungrouped locks can be reassigned to other groups'
        ],
        nextSteps: [
          'If you want to reorganize:',
          '  1. Create a new group with desired name',
          '  2. Use setLockGroup API to assign locks to new group',
          '  3. Filter lock list to see ungrouped locks (no groupId filter)',
          '',
          'If deletion was accidental:',
          '  1. Create a new group with the same name',
          '  2. Manually reassign all affected locks',
          '  3. Note: You will get a new groupId'
        ],
        useCases: [
          'Remove obsolete organizational structure',
          'Clean up unused groups',
          'Reorganize group structure',
          'Remove temporary project groups',
          'Consolidate multiple groups'
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Delete group error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to delete group';
      let errorCode = 'DELETE_GROUP_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
        message: 'Internal server error while deleting group',
        details: error.message
      }
    });
  }
};

/**
 * Set the group of a lock
 * @route POST /api/ttlock-v3/lock/set-group
 */
export const setLockGroup = async (req, res) => {
  try {
    const {
      accessToken,
      lockId,
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

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(lockId),
      groupId: parseInt(groupId),
      date: Date.now()
    };

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/setGroup`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to set lock group';
      let errorCode = 'SET_LOCK_GROUP_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3) {
        errorMessage = 'Invalid parameter - check lock ID and group ID';
        errorCode = 'INVALID_PARAMETER';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
      message: 'Lock group assignment updated successfully',
      data: {
        lockId: parseInt(lockId),
        groupId: parseInt(groupId),
        updatedAt: new Date().toISOString(),
        notes: [
          'Lock has been assigned to the specified group',
          'Lock will now appear when filtering by this groupId',
          'Previous group assignment (if any) has been replaced',
          'Ekeys for this lock may also be grouped automatically',
          'Lock functionality is not affected'
        ],
        whatHappened: {
          lockAssigned: true,
          newGroupId: parseInt(groupId),
          previousGroup: 'Replaced (if lock was in another group)',
          lockFunctionality: 'Not affected - lock works normally',
          ekeyAccess: 'Not affected - all ekeys still work',
          visibility: 'Lock now appears in this group when filtering'
        },
        howToUse: {
          filterByThisGroup: `When getting lock list, add groupId=${groupId} to see this lock`,
          viewAllLocksInGroup: `All locks with groupId=${groupId} will be shown together`,
          organizeAccess: 'Manage all locks in this group together',
          reorganize: 'Change groupId anytime to move lock to different group'
        },
        importantNotes: [
          'Lock can only belong to ONE group at a time',
          'Previous group assignment is replaced (not added to)',
          'To remove from all groups, you would need to delete the group or reassign',
          'Lock functionality is not affected by group changes',
          'Ekey access is not affected by group changes',
          'Use filtering to view locks by group in lock list API'
        ],
        useCases: [
          'Assign newly initialized lock to a group',
          'Move lock from one group to another (reorganization)',
          'Organize locks by building/floor/property',
          'Group locks by access level or department',
          'Facilitate bulk management of related locks',
          'Separate locks by location for better management'
        ],
        examples: [
          {
            scenario: 'Assign lock to Building A group',
            action: 'Use this API with the Building A groupId',
            result: 'Lock now appears when filtering by Building A'
          },
          {
            scenario: 'Move lock from Building A to Building B',
            action: 'Use this API with Building B groupId',
            result: 'Lock removed from Building A, now in Building B'
          },
          {
            scenario: 'Organize new property locks',
            action: 'Create group for property, assign all locks to it',
            result: 'All property locks organized under one group'
          }
        ]
      },
      ttlock_response: response.data
    });

  } catch (error) {
    console.error('Set lock group error:', error.response?.data || error.message);

    if (error.response) {
      let errorMessage = error.response.data.errmsg || error.response.data.description || 'Failed to set lock group';
      let errorCode = 'SET_LOCK_GROUP_FAILED';

      if (error.response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response.data.errcode === -3) {
        errorMessage = 'Invalid parameter';
        errorCode = 'INVALID_PARAMETER';
      } else if (error.response.data.errcode === -2003) {
        errorMessage = 'Lock not found';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (error.response.data.errcode === -3023) {
        errorMessage = 'Group does not exist';
        errorCode = 'GROUP_NOT_FOUND';
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
        message: 'Internal server error while setting lock group',
        details: error.message
      }
    });
  }
};
