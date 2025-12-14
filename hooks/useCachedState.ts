import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { getCachedData, setCachedData, subscribeToDataCacheClear } from '@/utils/cache';

type CacheListener = (value: unknown) => void;

const cacheKeyListeners = new Map<string, Set<CacheListener>>();

const subscribeToCacheKey = (cacheKey: string, listener: CacheListener): (() => void) => {
  if (!cacheKeyListeners.has(cacheKey)) {
    cacheKeyListeners.set(cacheKey, new Set());
  }
  cacheKeyListeners.get(cacheKey)!.add(listener);
  return () => {
    cacheKeyListeners.get(cacheKey)?.delete(listener);
  };
};

const broadcastCacheKeyUpdate = (cacheKey: string, value: unknown): void => {
  const listeners = cacheKeyListeners.get(cacheKey);
  if (!listeners) return;
  listeners.forEach(listener => {
    try {
      listener(value);
    } catch (error) {
      console.log('Error notifying cache key listener', error);
    }
  });
};

export const useCachedState = <T>(cacheKey: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] => {
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    initialRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    let isMounted = true;
    setHydrated(false);
    setState(initialRef.current);
    (async () => {
      const cached = await getCachedData<T>(cacheKey);
      if (cached !== null && isMounted) {
        setState(cached);
      }
      if (isMounted) {
        setHydrated(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    const unsubscribe = subscribeToDataCacheClear(() => {
      setState(initialRef.current);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCacheKey(cacheKey, value => {
      setState(value as T);
    });

    return unsubscribe;
  }, [cacheKey]);

  const setCachedState = useCallback(
    (value: React.SetStateAction<T>) => {
      setState(prev => {
        const next =
          typeof value === 'function'
            ? (value as (prevState: T) => T)(prev)
            : value;
        void setCachedData(cacheKey, next);
        broadcastCacheKeyUpdate(cacheKey, next);
        return next;
      });
    },
    [cacheKey]
  );

  return [state, setCachedState, hydrated];
};
