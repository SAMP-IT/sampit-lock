import { useMemo } from 'react';

/**
 * Role definitions with their permission capabilities
 */
const ROLE_CONFIG = {
  owner: {
    title: 'Owner',
    description: 'Primary lock owner with ultimate authority',
    priority: 1
  },
  admin: {
    title: 'Admin',
    description: 'Trusted administrator/manager',
    priority: 2
  },
  family: {
    title: 'Family / Resident',
    description: 'Household member with transparency',
    priority: 3
  },
  restricted: {
    title: 'Restricted / Scheduled',
    description: 'Staff, drivers, cleaners with time-based access',
    priority: 4
  },
  long_term_guest: {
    title: 'Long Term Guest',
    description: 'Airbnb, rental, tenant with auto-expiring access',
    priority: 5
  },
  guest: {
    title: 'Guest',
    description: 'Basic short-term access',
    priority: 6
  }
};

/**
 * Hook to get role-based permissions for a lock
 *
 * @param {Object} lock - Lock object with userRole/user_role and permission flags
 * @returns {Object} Permissions object with computed capabilities
 *
 * @example
 * const { canManageUsers, showDangerZone, role } = useRolePermissions(currentLock);
 */
export const useRolePermissions = (lock) => {
  return useMemo(() => {
    if (!lock) {
      return {
        role: null,
        roleTitle: 'Unknown',
        roleDescription: '',

        // Basic access
        canUnlock: false,
        canLock: false,

        // Log visibility
        canViewLogs: false,
        canViewAllLogs: false,
        canViewOwnLogsOnly: false,

        // Management
        canManageUsers: false,
        canModifySettings: false,

        // Owner-only
        canFactoryReset: false,
        canDeleteLock: false,
        canTransferOwnership: false,

        // Credential management
        canManageOwnCredentials: false,
        canManageAllCredentials: false,

        // Time restrictions
        isTimeRestricted: false,
        hasAccessExpiry: false,

        // UI visibility helpers
        showQuickActions: false,
        showSettings: false,
        showUserManagement: false,
        showDangerZone: false,
        showActivityLog: false,

        // Role config
        roleConfig: null
      };
    }

    // Normalize role from different possible properties
    const role = lock.userRole || lock.user_role || lock.role || 'guest';
    const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.guest;

    // Extract permission flags with defaults
    const canUnlock = lock.can_unlock !== false;
    const canLock = lock.can_lock !== false;
    const canViewLogs = lock.can_view_logs !== false && role !== 'guest';
    const canManageUsers = lock.can_manage_users === true || ['owner', 'admin'].includes(role);
    const canModifySettings = lock.can_modify_settings === true || ['owner', 'admin'].includes(role);
    const canManageOwnCredentials = lock.can_manage_own_credentials !== false;
    const canViewOwnLogsOnly = lock.can_view_own_logs_only === true ||
                               ['restricted', 'long_term_guest', 'guest'].includes(role);
    const isTimeRestricted = lock.time_restricted === true || role === 'restricted';
    const hasAccessExpiry = !!lock.access_valid_until;

    return {
      role,
      roleTitle: roleConfig.title,
      roleDescription: roleConfig.description,

      // Basic access
      canUnlock,
      canLock,

      // Log visibility
      canViewLogs: ['owner', 'admin', 'family', 'restricted'].includes(role) || canViewLogs,
      canViewAllLogs: ['owner', 'admin', 'family'].includes(role) && !canViewOwnLogsOnly,
      canViewOwnLogsOnly,

      // Management
      canManageUsers,
      canModifySettings,

      // Owner-only
      canFactoryReset: role === 'owner',
      canDeleteLock: role === 'owner',
      canTransferOwnership: role === 'owner',

      // Credential management
      canManageOwnCredentials,
      canManageAllCredentials: ['owner', 'admin'].includes(role),

      // Time restrictions
      isTimeRestricted,
      hasAccessExpiry,

      // Access schedule details
      daysOfWeek: lock.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      timeRestrictionStart: lock.time_restriction_start,
      timeRestrictionEnd: lock.time_restriction_end,
      accessValidFrom: lock.access_valid_from,
      accessValidUntil: lock.access_valid_until,

      // UI visibility helpers
      showQuickActions: !['guest', 'restricted', 'long_term_guest'].includes(role),
      showSettings: ['owner', 'admin'].includes(role) || canModifySettings,
      showUserManagement: canManageUsers,
      showDangerZone: role === 'owner',
      showActivityLog: role !== 'guest',
      showCredentialManagement: ['owner', 'admin', 'family'].includes(role),

      // Role config
      roleConfig,

      // Helper to check if user can manage another user's role
      canManageRole: (targetRole) => {
        if (role === 'owner') return true; // Owner can manage everyone
        if (role === 'admin') {
          // Admin can manage everyone except owner and other admins
          return targetRole !== 'owner' && targetRole !== 'admin';
        }
        return false;
      },

      // Helper to check if user can perform an action
      canPerformAction: (action) => {
        switch (action) {
          case 'unlock':
          case 'lock':
            return canUnlock && canLock;
          case 'view_logs':
            return canViewLogs;
          case 'manage_users':
            return canManageUsers;
          case 'modify_settings':
            return canModifySettings;
          case 'factory_reset':
          case 'delete_lock':
            return role === 'owner';
          case 'manage_credentials':
            return canManageOwnCredentials;
          default:
            return false;
        }
      }
    };
  }, [lock]);
};

/**
 * Get role configuration by role name
 * @param {string} role - Role name
 * @returns {Object} Role configuration
 */
export const getRoleConfig = (role) => ROLE_CONFIG[role] || ROLE_CONFIG.guest;

/**
 * Get all available roles for user selection
 * @param {boolean} includeOwner - Whether to include owner role (typically false when adding users)
 * @returns {Array} Array of role objects
 */
export const getAvailableRoles = (includeOwner = false) => {
  return Object.entries(ROLE_CONFIG)
    .filter(([key]) => includeOwner || key !== 'owner')
    .filter(([key]) => key !== 'guest') // Hide legacy guest role
    .map(([id, config]) => ({
      id,
      ...config
    }))
    .sort((a, b) => a.priority - b.priority);
};

export default useRolePermissions;
