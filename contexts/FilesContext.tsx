import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { openAttachment } from '@/utils/files/openAttachment';
import {
  CachedFileMeta,
  clearCachedFiles,
  getCachedFile,
  saveCachedFileMeta,
  storeDownloadedFile,
} from '@/utils/files/localFileStorage';

export type FileRecord = {
  id: number;
  name: string;
  original_name: string;
  storedName: string;
  localUri: string;
  local_path: string;
  mimeType?: string;
  mime?: string;
  file_type?: string;
  size?: number;
  file_size?: number;
  downloadedAt: number;
  downloaded: number;
};

type FilesContextType = {
  getFilesForEntity: (entityType: string, entityId: number) => Promise<FileRecord[]>;
  registerEntityFiles: (entityType: string, entityId: number, fileIds: number[]) => Promise<void>;
  ensureFilesDownloadedForEntity: (entityType: string, entityId: number) => Promise<void>;
  openFile: (file: FileRecord) => Promise<void>;
  clearAllFiles: () => Promise<void>;
  clearLocalFiles: () => Promise<void>;
  getFile: (fileId: number) => Promise<string | null>;
  getFileMetadata: (fileId: number) => Promise<FileRecord | null>;
  uploadFile: (
    fileUri: string,
    originalName: string,
    fileType: string,
    fileSize: number,
  ) => Promise<FileRecord | null>;
};

const FilesContext = createContext<FilesContextType>({} as FilesContextType);
export const FileContext = FilesContext;

const getAvailableBaseDirectory = (): string | null => {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!base) return null;
  return base.endsWith('/') ? base : `${base}/`;
};

const FILES_DIR = (() => {
  const base = getAvailableBaseDirectory();
  return base ? `${base}files/` : null;
})();
const ENTITY_INDEX_KEY = 'FILES_ENTITY_INDEX_V1';
const resolveTempDirectory = async (): Promise<string | null> => {
  const normalizedBase = getAvailableBaseDirectory();

  if (!normalizedBase) {
    console.warn('No se pudo resolver un directorio temporal para descargas.');
    return null;
  }

  const tempDir = `${normalizedBase}tmp/`;

  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});

  return tempDir;
};

type EntityFileIndex = Record<string, number[]>;

const buildEntityKey = (entityType: string, entityId: number): string => `${entityType}:${entityId}`;

const parseFileName = (disposition: string | null, fallback: string): string => {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename\*?=([^;]+)/i);
  if (match) {
    const raw = match[1].trim();
    if (raw.startsWith("UTF-8''")) {
      const encoded = raw.replace("UTF-8''", '');
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
    return raw.replace(/^"|"$/g, '');
  }

  return fallback;
};

const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
};

const buildRecordFromMeta = async (meta: CachedFileMeta): Promise<FileRecord> => {
  const exists = meta.localUri
    ? await FileSystem.getInfoAsync(meta.localUri).then(info => info.exists).catch(() => false)
    : false;

  return {
    id: meta.id,
    name: meta.originalName,
    original_name: meta.originalName,
    storedName: meta.storedName,
    localUri: meta.localUri,
    local_path: meta.localUri,
    mimeType: meta.mimeType,
    mime: meta.mimeType,
    file_type: meta.mimeType,
    size: meta.size,
    file_size: meta.size,
    downloadedAt: meta.downloadedAt,
    downloaded: exists ? 1 : 0,
  };
};

export const FilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isOffline } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(true);

  // ---- network state ----
  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => sub();
  }, []);

  useEffect(() => {
    if (isOffline) {
      setIsOnline(false);
    }
  }, [isOffline]);

  // ---- ensure directory ----
  useEffect(() => {
    if (!FILES_DIR) return;
    FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true }).catch(() => {});
  }, []);

  const loadEntityIndex = useCallback(async (): Promise<EntityFileIndex> => {
    try {
      const stored = await AsyncStorage.getItem(ENTITY_INDEX_KEY);
      return stored ? (JSON.parse(stored) as EntityFileIndex) : {};
    } catch (error) {
      console.log('No se pudo leer el índice de archivos por entidad', error);
      return {};
    }
  }, []);

  const persistEntityIndex = useCallback(async (index: EntityFileIndex): Promise<void> => {
    try {
      await AsyncStorage.setItem(ENTITY_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.log('No se pudo guardar el índice de archivos por entidad', error);
    }
  }, []);

  const registerEntityFiles = useCallback(
    async (entityType: string, entityId: number, fileIds: number[]) => {
      const normalized = Array.from(
        new Set(
          fileIds
            .map(value => (typeof value === 'number' ? value : Number(value)))
            .filter(value => Number.isFinite(value)),
        ),
      );

      const index = await loadEntityIndex();
      const key = buildEntityKey(entityType, entityId);

      if (normalized.length === 0) {
        delete index[key];
      } else {
        index[key] = normalized;
      }

      await persistEntityIndex(index);
    },
    [loadEntityIndex, persistEntityIndex],
  );

  const resolveEntityFileIds = useCallback(
    async (entityType: string, entityId: number): Promise<number[]> => {
      const index = await loadEntityIndex();
      const key = buildEntityKey(entityType, entityId);
      return index[key] ?? [];
    },
    [loadEntityIndex],
  );

  const downloadAndCacheFile = useCallback(
    async (fileId: number, fallbackName?: string, fallbackMimeType?: string) => {
      if (!token) {
        throw new Error('No hay token disponible para descargar el archivo.');
      }

      const url = `${BASE_URL.replace(/\/+$/, '')}/files/${fileId}`;
      const tempDir = await resolveTempDirectory();
      if (!tempDir) {
        return null;
      }

      const tempUri = `${tempDir}file_${fileId}_${Date.now()}`;

      const result = await FileSystem.downloadAsync(url, tempUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (typeof result.status === 'number' && (result.status < 200 || result.status >= 300)) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
        throw new Error(`No se pudo descargar el archivo ${fileId}. HTTP ${result.status}.`);
      }

      const headers = normalizeHeaders((result?.headers as Record<string, string> | undefined) ?? {});
      const originalName = parseFileName(
        headers['content-disposition'] ?? null,
        fallbackName ?? `archivo_${fileId}`,
      );
      const mimeType = headers['content-type'] ?? fallbackMimeType ?? 'application/octet-stream';
      const info = await FileSystem.getInfoAsync(result.uri);

      return storeDownloadedFile(fileId, originalName, result.uri, {
        mimeType,
        size: typeof info.size === 'number' ? info.size : undefined,
      });
    },
    [token],
  );

  // ---- queries ----
  const getFilesForEntity = useCallback(
    async (entityType: string, entityId: number): Promise<FileRecord[]> => {
      const ids = await resolveEntityFileIds(entityType, entityId);
      if (ids.length === 0) return [];

      const records = await Promise.all(ids.map(id => getFileMetadata(id)));
      return records.filter((record): record is FileRecord => Boolean(record));
    },
    [getFileMetadata, resolveEntityFileIds],
  );

  const getFileMetadata = useCallback(
    async (fileId: number) => {
      const cached = await getCachedFile(fileId);
      if (cached) {
        return buildRecordFromMeta(cached);
      }

      return null;
    },
    [],
  );

  const getFile = useCallback(
    async (fileId: number): Promise<string | null> => {
      const cachedMeta = await getCachedFile(fileId);

      if (cachedMeta?.localUri) {
        const info = await FileSystem.getInfoAsync(cachedMeta.localUri);
        if (info.exists) {
          return cachedMeta.localUri;
        }
      }

      if (!isOnline || !token) {
        Alert.alert('Sin conexión', 'El archivo no está disponible offline.');
        return null;
      }

      try {
        const downloadedMeta = await downloadAndCacheFile(fileId, cachedMeta?.originalName, cachedMeta?.mimeType);
        return downloadedMeta?.localUri ?? null;
      } catch (error) {
        console.warn('No se pudo descargar y cachear el archivo', fileId, error);
        return null;
      }
    },
    [downloadAndCacheFile, isOnline, token],
  );

  const uploadFile = useCallback(
    async (
      fileUri: string,
      originalName: string,
      fileType: string,
      fileSize: number,
    ): Promise<FileRecord | null> => {
      if (!token) {
        Alert.alert('Sesión inválida', 'No hay token disponible para subir archivos.');
        return null;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: originalName,
        type: fileType,
      } as any);

      const response = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        Alert.alert('Error', 'No se pudo subir el archivo.');
        return null;
      }

      const data = await response.json();
      const uploaded: any = data?.file;

      if (!uploaded?.id) {
        return null;
      }

      const tempDir = await resolveTempDirectory();
      const tempPath = tempDir ? `${tempDir}uploaded_${uploaded.id}_${Date.now()}` : fileUri;

      if (tempDir) {
        await FileSystem.copyAsync({ from: fileUri, to: tempPath });
      }

      const storedMeta = await storeDownloadedFile(
        uploaded.id,
        uploaded.original_name ?? uploaded.name ?? originalName,
        tempPath,
        {
          mimeType: uploaded.file_type ?? uploaded.mime ?? fileType,
          size: uploaded.file_size ?? uploaded.size ?? fileSize,
        },
      );

      return buildRecordFromMeta(storedMeta);
    },
    [token],
  );

  const ensureFilesDownloadedForEntity = useCallback(
    async (entityType: string, entityId: number) => {
      if (!isOnline || !token) return;

      const fileIds = await resolveEntityFileIds(entityType, entityId);

      for (const fileId of fileIds) {
        try {
          await getFile(fileId);
        } catch (error) {
          console.warn('Error descargando archivo', fileId, error);
        }
      }
    },
    [getFile, isOnline, resolveEntityFileIds, token],
  );

  // ---- open ----
  const openFile = useCallback(
    async (file: FileRecord) => {
      const uri = file.local_path || file.localUri || (await getFile(file.id));

      if (!uri) {
        throw new Error('Archivo no disponible offline');
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('Archivo local inexistente');
      }

      const opened = await openAttachment({
        uri,
        mimeType: file.mimeType || file.mime || file.file_type,
        fileName: file.original_name || file.name,
      });

      if (!opened) {
        throw new Error('No se pudo abrir el archivo con la plataforma actual.');
      }
    },
    [getFile],
  );

  // ---- cleanup ----
  const clearAllFiles = useCallback(async () => {
    const directories = [
      FileSystem.documentDirectory ? `${FileSystem.documentDirectory}files/` : null,
      FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}files/` : null,
      FileSystem.documentDirectory ? `${FileSystem.documentDirectory}tmp/` : null,
      FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}tmp/` : null,
    ].filter(Boolean) as string[];

    for (const dir of directories) {
      try {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      } catch (error) {
        console.log('No se pudo limpiar el directorio de archivos', error);
      }
    }

    if (FileSystem.documentDirectory) {
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}files/`, {
        intermediates: true,
      }).catch(() => {});
    }

    await clearCachedFiles();
    await AsyncStorage.removeItem(ENTITY_INDEX_KEY);
  }, []);

  const clearLocalFiles = useCallback(async () => {
    await clearAllFiles();
  }, [clearAllFiles]);

  return (
    <FilesContext.Provider
      value={{
        getFilesForEntity,
        registerEntityFiles,
        ensureFilesDownloadedForEntity,
        openFile,
        clearAllFiles,
        clearLocalFiles,
        getFile,
        getFileMetadata,
        uploadFile,
      }}
    >
      {children}
    </FilesContext.Provider>
  );
};

export const useFiles = () => useContext(FilesContext);
