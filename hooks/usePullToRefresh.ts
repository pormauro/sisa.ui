import { useCallback, useState } from 'react';

/**
 * Simple helper hook to add pull-to-refresh behavior to list components.
 */
export function usePullToRefresh(
  refreshFn: () => Promise<unknown> | void,
  enabled = true
) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setRefreshing(true);
    try {
      await Promise.resolve(refreshFn());
    } catch (error) {
      console.error('Error refreshing list', error);
    } finally {
      setRefreshing(false);
    }
  }, [enabled, refreshFn]);

  return {
    refreshing: enabled ? refreshing : false,
    handleRefresh,
  };
}
