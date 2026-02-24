import { useQuery } from '@tanstack/react-query';
import { getLocks, getRecentActivity, getLockById, getAllActivity, getActivityByLockId, getTTLockStatus } from '../services/api';
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
