import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { clearFileCaches } from '@/utils/cache';
import { fileStorage } from '@/utils/files/storage';

const isFileCacheKey = (key: string): boolean =>
  key.startsWith('@sisa:file:') || key.startsWith('file_meta_');

const deleteIfExists = async (uri?: string | null): Promise<void> => {
  if (!uri) {
    return;
  }
  try {
    await fileStorage.delete(uri);
  } catch (error) {
    console.log('Error deleting cached file', error);
  }
};

const clearCacheDirectory = async (): Promise<void> => {
  try {
    if (FileSystem.cacheDirectory) {
      await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true });
    }
  } catch (error) {
    console.log('Error clearing cache directory', error);
  }
};

export const clearLocalFileStorage = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const fileKeys = keys.filter(isFileCacheKey);
  const metas = await AsyncStorage.multiGet(fileKeys);

  await Promise.all(
    metas.map(async ([, value]) => {
      if (!value) {
        return;
      }
      try {
        const meta = JSON.parse(value) as { localUri?: string; storagePath?: string };
        const target = meta.storagePath ?? meta.localUri;
        await deleteIfExists(target);
      } catch (error) {
        console.log('Error parsing cached file metadata', error);
      }
    })
  );

  await Promise.all([clearFileCaches(), clearCacheDirectory()]);
};
