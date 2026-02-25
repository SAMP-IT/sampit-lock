import { useQuery } from '@tanstack/react-query';
import {
  getLocks, getRecentActivity, getLockById, getAllActivity, getActivityByLockId, getTTLockStatus,
  getAllUsersForAllLocks, getNotifications, getAIInsights, getRiskScore, getDailySummary,
  getAccessCodes, getUserAccessMethods, getLockInvites, backendApi,
} from '../services/api';
import { unwrapResponseArray } from '../utils/apiResponse';

/**
 * Hook to fetch all locks for the current user
 */
export const useLocks = (options = {}) => {
  return useQuery({
    queryKey: ['locks'],
    queryFn: async () => {
      const response = await getLocks();
      return unwrapResponseArray(response);
    },
    staleTime: 2 * 60 * 1000, // 2 min
    ...options,
  });
};

/**
 * Hook to fetch recent activity across all locks
 */
export const useRecentActivity = (options = {}) => {
  return useQuery({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      const response = await getRecentActivity();
      const data = response?.data?.data ?? response?.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1 * 60 * 1000, // 1 min
    ...options,
  });
};

/**
 * Hook to fetch a single lock by ID
 */
export const useLockDetail = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['lock', lockId],
    queryFn: async () => {
      const response = await getLockById(lockId);
      const data = response?.data?.data ?? response?.data;
      return data;
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch activities with filters (for HistoryScreen)
 */
export const useActivities = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      const response = await getAllActivity(filters);
      const responseData = response?.data?.data ?? response?.data ?? {};
      const activityData = responseData.activities ?? responseData ?? [];
      const pagination = responseData.pagination ?? {};
      return {
        activities: Array.isArray(activityData) ? activityData : [],
        totalCount: pagination.total || (Array.isArray(activityData) ? activityData.length : 0),
      };
    },
    staleTime: 1 * 60 * 1000,
    placeholderData: (previousData) => previousData, // Keep previous data during filter changes
    ...options,
  });
};

/**
 * Hook to fetch activity for a specific lock
 */
export const useLockActivity = (lockId, filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['lockActivity', lockId, filters],
    queryFn: async () => {
      const response = await getActivityByLockId(lockId, filters);
      const data = response?.data?.data ?? response?.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!lockId,
    staleTime: 1 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch TTLock connection status
 */
export const useTTLockStatus = (options = {}) => {
  return useQuery({
    queryKey: ['ttlockStatus'],
    queryFn: async () => {
      const response = await getTTLockStatus();
      const payload = response?.data ?? response;
      return payload?.data ?? payload;
    },
    staleTime: 5 * 60 * 1000, // 5 min
    ...options,
  });
};

/**
 * Hook to fetch all users across all locks (UserManagementScreen)
 */
export const useAllUsersForAllLocks = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['allUsersForAllLocks', filters],
    queryFn: async () => {
      const response = await getAllUsersForAllLocks(filters);
      return response?.data?.data || { users: [], locks: [], stats: { total_users: 0, admins: 0, family: 0 } };
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

/**
 * Hook to fetch notifications
 */
export const useNotifications = (options = {}) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await getNotifications();
      return response.data ?? [];
    },
    staleTime: 1 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch fingerprints for a lock
 */
export const useFingerprints = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['fingerprints', lockId],
    queryFn: async () => {
      const response = await backendApi.get(`/locks/${lockId}/fingerprints`);
      return response.data?.success ? (response.data.data || []) : [];
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch IC cards for a lock
 */
export const useCards = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['cards', lockId],
    queryFn: async () => {
      const response = await backendApi.get(`/locks/${lockId}/cards`);
      return response.data?.success ? (response.data.data || []) : [];
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch AI insights for a lock
 */
export const useAIInsights = (lockId, params = {}, options = {}) => {
  return useQuery({
    queryKey: ['aiInsights', lockId, params],
    queryFn: async () => {
      const response = await getAIInsights(lockId, params);
      return response.data?.success ? (response.data.data?.insights || []) : [];
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch risk score for a lock
 */
export const useRiskScore = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['riskScore', lockId],
    queryFn: async () => {
      const response = await getRiskScore(lockId);
      return response.data?.success ? response.data.data : null;
    },
    enabled: !!lockId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch daily summary for a lock
 */
export const useDailySummary = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['dailySummary', lockId],
    queryFn: async () => {
      const response = await getDailySummary(lockId);
      return response.data?.success ? response.data.data : null;
    },
    enabled: !!lockId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch access codes for a lock
 */
export const useAccessCodes = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['accessCodes', lockId],
    queryFn: async () => {
      const response = await getAccessCodes(lockId);
      return response.data || [];
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch access methods for a user on a lock
 */
export const useAccessMethods = (lockId, userId, options = {}) => {
  return useQuery({
    queryKey: ['accessMethods', lockId, userId],
    queryFn: async () => {
      const response = await getUserAccessMethods(lockId, userId);
      return response.data || [];
    },
    enabled: !!lockId && !!userId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to fetch invites for a lock
 */
export const useInvites = (lockId, options = {}) => {
  return useQuery({
    queryKey: ['invites', lockId],
    queryFn: async () => {
      const response = await getLockInvites(lockId);
      return response.data || [];
    },
    enabled: !!lockId,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
};
