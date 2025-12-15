import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { getCachedData, readAllDataCaches, setCachedData, subscribeToDataCacheClear } from '@/utils/cache';

const memoryCache = new Map<string, unknown>();

export const primeMemoryCacheFromStorage = async (): Promise<void> => {
  const cachedEntries = await readAllDataCaches();

  Object.entries(cachedEntries).forEach(([cacheKey, value]) => {
    if (memoryCache.has(cacheKey)) {
      return;
    }

    memoryCache.set(cacheKey, value);
  });
};

export const useCachedState = <T>(cacheKey: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] => {
  const [state, setState] = useState<T>(() => {
    const cached = memoryCache.get(cacheKey);
    return (cached as T | undefined) ?? initialValue;
  });
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    initialRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    let isMounted = true;
    setHydrated(false);
    (async () => {
      const cached = await getCachedData<T>(cacheKey);
      if (!isMounted) {
        return;
      }

      const hasMemoryValue = memoryCache.has(cacheKey);

      if (!hasMemoryValue) {
        if (cached !== null) {
          memoryCache.set(cacheKey, cached);
          setState(cached);
        } else {
          memoryCache.set(cacheKey, initialRef.current);
          setState(initialRef.current);
        }
      }

      setHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    const unsubscribe = subscribeToDataCacheClear(() => {
      memoryCache.delete(cacheKey);
      setState(initialRef.current);
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
        memoryCache.set(cacheKey, next);
        void setCachedData(cacheKey, next);
        return next;
      });
    },
    [cacheKey]
  );

  return [state, setCachedState, hydrated];
};
