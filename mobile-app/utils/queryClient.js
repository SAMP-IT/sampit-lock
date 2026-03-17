import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

/**
 * Clear all React Query cache - call on logout to prevent stale data
 * from previous user appearing when a new user logs in.
 */
export const clearQueryCacheOnLogout = () => {
  queryClient.clear();
};

/**
 * Invalidate cache after a lock is deleted - prevents stale refetches
 * and "lock not found" errors from components still holding the lock id.
 */
export const invalidateCacheAfterLockDelete = (lockId) => {
  if (!lockId) return;
  queryClient.removeQueries({ queryKey: ['lock', lockId] });
  queryClient.invalidateQueries({ queryKey: ['locks'] });
  queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
};
