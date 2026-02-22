import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FILES_CACHE_KEY = 'FILES_LOCAL_CACHE_V1';

export type CachedFileMeta = {
  id: number;
  originalName: string;
  storedName: string;
  localUri: string;
  downloadedAt: number;
  size?: number;
  mimeType?: string;
};

type CachedFilesMap = Record<number, CachedFileMeta>;

const getBaseDirectory = (): string => {
  const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error('No hay un directorio de documentos disponible para almacenar archivos.');
  }
  return `${baseDir}files`;
};

const loadCache = async (): Promise<CachedFilesMap> => {
  const raw = await AsyncStorage.getItem(FILES_CACHE_KEY);
  return raw ? JSON.parse(raw) : {};
};

const saveCache = async (cache: CachedFilesMap): Promise<void> => {
  await AsyncStorage.setItem(FILES_CACHE_KEY, JSON.stringify(cache));
};

const splitName = (filename: string): { base: string; ext: string } => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return { base: filename, ext: '' };
  }
  return {
    base: filename.substring(0, lastDot),
    ext: filename.substring(lastDot),
  };
};

const getAvailableName = async (dir: string, filename: string): Promise<string> => {
  const { base, ext } = splitName(filename);

  let attempt = 0;
  let finalName = filename;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const path = `${dir}/${finalName}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return finalName;
    }
    attempt += 1;
    finalName = `${base}(${attempt})${ext}`;
  }
};

const persistCacheEntry = async (meta: CachedFileMeta): Promise<CachedFileMeta> => {
  const cache = await loadCache();
  cache[meta.id] = meta;
  await saveCache(cache);
  return meta;
};

export const storeDownloadedFile = async (
  fileId: number,
  originalName: string,
  tempUri: string,
  options?: { size?: number; mimeType?: string }
): Promise<CachedFileMeta> => {
  const normalizedName = originalName.trim() || `archivo_${fileId}`;
  const baseDir = `${getBaseDirectory()}/${fileId}`;

  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

  const storedName = await getAvailableName(baseDir, normalizedName);
  const finalUri = `${baseDir}/${storedName}`;

  await FileSystem.moveAsync({
    from: tempUri,
    to: finalUri,
  });

  const finalInfo = await FileSystem.getInfoAsync(finalUri);

  return persistCacheEntry({
    id: fileId,
    originalName: normalizedName,
    storedName,
    localUri: finalUri,
    downloadedAt: Date.now(),
    size: typeof options?.size === 'number' ? options.size : finalInfo.size,
    mimeType: options?.mimeType,
  });
};

export const saveCachedFileMeta = async (meta: CachedFileMeta): Promise<CachedFileMeta> => {
  return persistCacheEntry(meta);
};

export const getCachedFile = async (fileId: number): Promise<CachedFileMeta | null> => {
  const cache = await loadCache();
  return cache[fileId] ?? null;
};

export const listCachedFiles = async (): Promise<CachedFileMeta[]> => {
  const cache = await loadCache();
  return Object.values(cache);
};

export const removeCachedFile = async (fileId: number): Promise<void> => {
  const cache = await loadCache();
  delete cache[fileId];
  await saveCache(cache);
};

export const clearCachedFiles = async (): Promise<void> => {
  await AsyncStorage.removeItem(FILES_CACHE_KEY);
};
