import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';
let secureStoreAvailable: boolean | null = null;
let cachedWebStorage: Storage | null | undefined;

const ensureSecureStoreAvailability = async () => {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }
  if (isWeb) {
    secureStoreAvailable = false;
    return secureStoreAvailable;
  }
  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch (error) {
    console.warn('SecureStore availability check failed, falling back to AsyncStorage.', error);
    secureStoreAvailable = false;
  }
  return secureStoreAvailable ?? false;
};

const getWebStorage = () => {
  if (cachedWebStorage !== undefined) {
    return cachedWebStorage;
  }
  if (typeof window === 'undefined') {
    cachedWebStorage = null;
    return cachedWebStorage;
  }
  try {
    cachedWebStorage = window.localStorage ?? null;
  } catch (error) {
    console.warn('Access to localStorage failed, falling back to AsyncStorage.', error);
    cachedWebStorage = null;
  }
  return cachedWebStorage;
};

const saveToWebStorage = async (key: string, value: string) => {
  const storage = getWebStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
};

const getFromWebStorage = async (key: string): Promise<string | null> => {
  const storage = getWebStorage();
  if (storage) {
    return storage.getItem(key);
  }
  return AsyncStorage.getItem(key);
};

const removeFromWebStorage = async (key: string) => {
  const storage = getWebStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
};

const getManyFromWebStorage = async (keys: string[]): Promise<(string | null)[]> => {
  const storage = getWebStorage();
  if (storage) {
    return keys.map((key) => storage.getItem(key));
  }
  const values = await AsyncStorage.multiGet(keys);
  return values.map(([, value]) => value);
};

export const saveItem = async (key: string, value: string) => {
  try {
    if (isWeb) {
      await saveToWebStorage(key, value);
      return;
    }
    if (await ensureSecureStoreAvailability()) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
};

export const getItem = async (key: string): Promise<string | null> => {
  try {
    if (isWeb) {
      return getFromWebStorage(key);
    }
    if (await ensureSecureStoreAvailability()) {
      return SecureStore.getItemAsync(key);
    }
    return AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`Error getting ${key}:`, error);
    return null;
  }
};

export const removeItem = async (key: string) => {
  try {
    if (isWeb) {
      await removeFromWebStorage(key);
      return;
    }
    if (await ensureSecureStoreAvailability()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error deleting ${key}:`, error);
  }
};

export const getInitialItems = async (keys: string[]): Promise<(string | null)[]> => {
  try {
    if (isWeb) {
      return getManyFromWebStorage(keys);
    }
    if (await ensureSecureStoreAvailability()) {
      return Promise.all(keys.map((key) => SecureStore.getItemAsync(key)));
    }
    const values = await AsyncStorage.multiGet(keys);
    return values.map(([, value]) => value);
  } catch (error) {
    console.error('Error during initial storage load:', error);
    return keys.map(() => null);
  }
};
