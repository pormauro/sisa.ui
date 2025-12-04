import AsyncStorage from '@react-native-async-storage/async-storage';

const DATA_CACHE_PREFIX = '@sisa:data:';
const FILE_CACHE_PREFIX = '@sisa:file:';
const LEGACY_FILE_PREFIX = 'file_meta_';

type CacheListener = () => void;

const dataCacheListeners = new Set<CacheListener>();
const fileCacheListeners = new Set<CacheListener>();

const broadcastListeners = (listeners: Set<CacheListener>): void => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.log('Error updating cache listener', error);
    }
  });
};

const buildDataKey = (key: string): string => `${DATA_CACHE_PREFIX}${key}`;
const buildFileKey = (id: number): string => `${FILE_CACHE_PREFIX}${id}`;

export const subscribeToDataCacheClear = (listener: CacheListener): (() => void) => {
  dataCacheListeners.add(listener);
  return () => {
    dataCacheListeners.delete(listener);
  };
};

export const subscribeToFileCacheClear = (listener: CacheListener): (() => void) => {
  fileCacheListeners.add(listener);
  return () => {
    fileCacheListeners.delete(listener);
  };
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  const storageKey = buildDataKey(key);
  try {
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as T;
    } catch (parseError) {
      console.log('Invalid cached payload, clearing entry for', key, parseError);
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
  } catch (error) {
    console.log('Error reading cache key', key, error);
    return null;
  }
};

export const setCachedData = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(buildDataKey(key), JSON.stringify(data));
  } catch (error) {
    console.log('Error writing cache key', key, error);
  }
};

export const clearAllDataCaches = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(DATA_CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.log('Error clearing data cache', error);
  } finally {
    broadcastListeners(dataCacheListeners);
  }
};

export const getCachedFileMeta = async <T>(id: number): Promise<T | null> => {
  const key = buildFileKey(id);
  try {
    const stored = (await AsyncStorage.getItem(key)) ?? (await AsyncStorage.getItem(`${LEGACY_FILE_PREFIX}${id}`));
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as T;
    } catch (parseError) {
      console.log('Invalid cached file metadata, clearing entry for', id, parseError);
      await AsyncStorage.multiRemove([key, `${LEGACY_FILE_PREFIX}${id}`]);
      return null;
    }
  } catch (error) {
    console.log('Error reading file cache for', id, error);
    return null;
  }
};

export const setCachedFileMeta = async <T>(id: number, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(buildFileKey(id), JSON.stringify(data));
  } catch (error) {
    console.log('Error writing file cache for', id, error);
  }
};

export const removeCachedFileMeta = async (id: number): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([buildFileKey(id), `${LEGACY_FILE_PREFIX}${id}`]);
  } catch (error) {
    console.log('Error removing file cache for', id, error);
  }
};

export const clearFileCaches = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key =>
      key.startsWith(FILE_CACHE_PREFIX) || key.startsWith(LEGACY_FILE_PREFIX)
    );
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.log('Error clearing file cache', error);
  } finally {
    broadcastListeners(fileCacheListeners);
  }
};
