import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { getCachedData, setCachedData, subscribeToDataCacheClear } from '@/utils/cache';

const memoryCache = new Map<string, unknown>();

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
      if (cached !== null && isMounted) {
        memoryCache.set(cacheKey, cached);
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
