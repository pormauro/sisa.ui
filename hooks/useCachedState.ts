import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  getCachedData,
  setCachedData,
  subscribeToDataCacheClear,
  subscribeToDataCacheKey,
} from '@/utils/cache';

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
    const unsubscribe = subscribeToDataCacheKey(cacheKey, value => {
      setState(prev => {
        const nextValue = value as T;
        return Object.is(prev, nextValue) ? prev : nextValue;
      });
      setHydrated(true);
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
        return next;
      });
    },
    [cacheKey]
  );

  return [state, setCachedState, hydrated];
};
