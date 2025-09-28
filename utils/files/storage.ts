import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

export interface FileStorageWriteResult {
  uri: string;
}

export interface FileStorageAdapter {
  documentDirectory: string;
  write: (path: string, base64: string, mimeType: string) => Promise<FileStorageWriteResult>;
  read: (path: string, mimeType: string) => Promise<string | null>;
  copy: (sourceUri: string, destinationPath: string, mimeType: string) => Promise<FileStorageWriteResult>;
  delete: (path: string) => Promise<void>;
}

type WebStorage = {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const WEB_PREFIX = '@sisa:webfile:';

interface WebStoredFile {
  base64: string;
  mimeType: string;
}

const memoryStore = new Map<string, WebStoredFile>();

const buildWebKey = (path: string): string => `${WEB_PREFIX}${path}`;

const getLocalStorage = (): WebStorage | null => {
  const globalRef: any = typeof globalThis !== 'undefined' ? globalThis : undefined;
  if (!globalRef || !globalRef.localStorage) {
    return null;
  }
  try {
    return globalRef.localStorage as WebStorage;
  } catch (error) {
    console.log('LocalStorage unavailable', error);
    return null;
  }
};

const persistWebRecord = (key: string, record: WebStoredFile): void => {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(record));
      return;
    } catch (error) {
      console.log('Error persisting file in localStorage', error);
    }
  }
  memoryStore.set(key, record);
};

const readWebRecord = (key: string): WebStoredFile | null => {
  const storage = getLocalStorage();
  if (storage) {
    try {
      const stored = storage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as WebStoredFile;
      }
    } catch (error) {
      console.log('Error reading file from localStorage', error);
    }
  }
  return memoryStore.get(key) ?? null;
};

const removeWebRecord = (key: string): void => {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.log('Error removing file from localStorage', error);
    }
  }
  memoryStore.delete(key);
};

const removeWebRecordByBase64 = (base64: string): void => {
  const storage = getLocalStorage();
  if (storage) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith(WEB_PREFIX)) {
          continue;
        }
        const item = storage.getItem(key);
        if (!item) {
          continue;
        }
        try {
          const record = JSON.parse(item) as WebStoredFile;
          if (record.base64 === base64) {
            storage.removeItem(key);
            break;
          }
        } catch (error) {
          console.log('Error parsing stored file', error);
        }
      }
    } catch (error) {
      console.log('Error iterating localStorage', error);
    }
  }
  for (const [key, record] of memoryStore.entries()) {
    if (record.base64 === base64) {
      memoryStore.delete(key);
      break;
    }
  }
};

const dataUriToBase64 = (uri: string): { base64: string; mimeType: string } | null => {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  const [, mimeType, base64] = match;
  return {
    base64,
    mimeType: mimeType || 'application/octet-stream',
  };
};

const fetchUriAsBase64 = async (
  uri: string,
  fallbackMimeType: string
): Promise<{ base64: string; mimeType: string }> => {
  const response = await fetch(uri);
  const mimeType = response.headers.get('Content-Type') || fallbackMimeType;
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, mimeType };
};

const webAdapter: FileStorageAdapter = {
  documentDirectory: '',
  write: async (path, base64, mimeType) => {
    const key = buildWebKey(path);
    persistWebRecord(key, {
      base64,
      mimeType,
    });
    const uri = `data:${mimeType};base64,${base64}`;
    return { uri };
  },
  read: async (path) => {
    const key = buildWebKey(path);
    const record = readWebRecord(key);
    return record?.base64 ?? null;
  },
  copy: async (sourceUri, destinationPath, mimeType) => {
    const parsed = dataUriToBase64(sourceUri);
    const { base64, mimeType: detectedMime } = parsed ?? (await fetchUriAsBase64(sourceUri, mimeType));
    return webAdapter.write(destinationPath, base64, mimeType || detectedMime);
  },
  delete: async (path) => {
    if (path.startsWith('data:')) {
      const parsed = dataUriToBase64(path);
      if (parsed) {
        removeWebRecordByBase64(parsed.base64);
      }
      return;
    }
    removeWebRecord(buildWebKey(path));
  },
};

const nativeAdapter: FileStorageAdapter = {
  documentDirectory: FileSystem.documentDirectory ?? '',
  write: async (path, base64) => {
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: path };
  },
  read: async (path) => {
    try {
      return await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      console.log('Error reading file from storage', error);
      return null;
    }
  },
  copy: async (sourceUri, destinationPath) => {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationPath });
    return { uri: destinationPath };
  },
  delete: async (path) => {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch (error) {
      console.log('Error deleting file from storage', error);
    }
  },
};

export const fileStorage: FileStorageAdapter =
  Platform.OS === 'web' ? webAdapter : nativeAdapter;
