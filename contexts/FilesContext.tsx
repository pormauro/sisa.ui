import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { getDatabase } from '@/database/Database';

export type FileRecord = {
  id: number;
  name: string;
  mime: string;
  size: number;
  checksum?: string | null;
  local_path?: string | null;
  downloaded: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type FilesContextType = {
  getFilesForEntity: (entityType: string, entityId: number) => Promise<FileRecord[]>;
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
    fileSize: number
  ) => Promise<FileRecord | null>;
};

const FilesContext = createContext<FilesContextType>({} as FilesContextType);
export const FileContext = FilesContext;

const FILES_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}files/`;

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
    if (!FileSystem.documentDirectory && !FileSystem.cacheDirectory) return;
    FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true }).catch(() => {});
  }, []);

  // ---- helpers ----
  const getDb = useCallback(async () => getDatabase(), []);
  const buildStoragePath = useCallback((fileId: number, mime: string) => {
    const extension = mime.split('/').pop() || 'bin';
    return `${FILES_DIR}${fileId}.${extension}`;
  }, []);

  const persistFileRecord = useCallback(
    async (record: FileRecord) => {
      const db = await getDb();
      await db.runAsync(
        `
        INSERT INTO files (id, name, mime, size, checksum, local_path, downloaded, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          mime = excluded.mime,
          size = excluded.size,
          checksum = excluded.checksum,
          local_path = excluded.local_path,
          downloaded = excluded.downloaded,
          created_at = COALESCE(excluded.created_at, files.created_at),
          updated_at = excluded.updated_at;
        `,
        [
          record.id,
          record.name,
          record.mime,
          record.size,
          record.checksum ?? null,
          record.local_path ?? null,
          record.downloaded ?? 0,
          record.created_at ?? null,
          record.updated_at ?? null,
        ]
      );
    },
    [getDb]
  );

  // ---- queries ----
  const getFilesForEntity = useCallback(
    async (entityType: string, entityId: number): Promise<FileRecord[]> => {
      const db = await getDb();

      const rows = await db.getAllAsync<FileRecord>(
        `
        SELECT f.*
        FROM files f
        JOIN entity_files ef ON ef.file_id = f.id
        WHERE ef.entity_type = ?
          AND ef.entity_id = ?
        ORDER BY ef.position ASC
        `,
        [entityType, entityId]
      );

      return (rows ?? []).map(row => ({ ...row, downloaded: Number(row.downloaded) }));
    },
    [getDb]
  );

  // ---- download logic ----
  const downloadFile = useCallback(
    async (file: FileRecord) => {
      if (!isOnline) return;
      if (!token) return;
      if (file.downloaded) return;

      const targetPath = FILES_DIR + file.id;
      const url = `${BASE_URL}/files/${file.id}`;

      const result = await FileSystem.downloadAsync(url, targetPath, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const db = await getDb();

      await db.runAsync(
        `
        UPDATE files
        SET downloaded = 1,
            local_path = ?
        WHERE id = ?
        `,
        [result.uri, file.id]
      );
    },
    [getDb, isOnline, token]
  );

  const getFileMetadata = useCallback(
    async (fileId: number) => {
      const db = await getDb();
      const row = await db.getFirstAsync<FileRecord>(
        `
        SELECT id, name, mime, size, checksum, local_path, downloaded, created_at, updated_at
        FROM files
        WHERE id = ?
        `,
        [fileId]
      );

      return row ? { ...row, downloaded: Number(row.downloaded) } : null;
    },
    [getDb]
  );

  const getFile = useCallback(
    async (fileId: number): Promise<string | null> => {
      const metadata = await getFileMetadata(fileId);

      if (metadata?.downloaded && metadata.local_path) {
        const info = await FileSystem.getInfoAsync(metadata.local_path);
        if (info.exists) {
          return metadata.local_path;
        }
      }

      if (!isOnline || !token) {
        Alert.alert('Sin conexión', 'El archivo no está disponible offline.');
        return null;
      }

      if (!metadata) {
        return null;
      }

      await downloadFile(metadata);
      const refreshed = await getFileMetadata(fileId);
      return refreshed?.local_path ?? null;
    },
    [downloadFile, getFileMetadata, isOnline, token]
  );

  const uploadFile = useCallback(
    async (
      fileUri: string,
      originalName: string,
      fileType: string,
      fileSize: number
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

      const targetPath = buildStoragePath(uploaded.id, fileType);
      await FileSystem.copyAsync({ from: fileUri, to: targetPath });

      const record: FileRecord = {
        id: uploaded.id,
        name: uploaded.original_name ?? uploaded.name ?? originalName,
        mime: uploaded.file_type ?? uploaded.mime ?? fileType,
        size: uploaded.file_size ?? uploaded.size ?? fileSize,
        checksum: uploaded.checksum ?? null,
        local_path: targetPath,
        downloaded: 1,
        created_at: uploaded.created_at ?? new Date().toISOString(),
        updated_at: uploaded.updated_at ?? new Date().toISOString(),
      };

      await persistFileRecord(record);
      return record;
    },
    [buildStoragePath, persistFileRecord, token]
  );

  const ensureFilesDownloadedForEntity = useCallback(
    async (entityType: string, entityId: number) => {
      if (!isOnline || !token) return;

      const files = await getFilesForEntity(entityType, entityId);

      for (const file of files) {
        if (!file.downloaded) {
          try {
            await downloadFile(file);
          } catch (e) {
            console.warn('Error descargando archivo', file.id, e);
          }
        }
      }
    },
    [downloadFile, getFilesForEntity, isOnline, token]
  );

  // ---- open ----
  const openFile = useCallback(
    async (file: FileRecord) => {
      if (!file.downloaded || !file.local_path) {
        throw new Error('Archivo no disponible offline');
      }

      const info = await FileSystem.getInfoAsync(file.local_path);
      if (!info.exists) {
        throw new Error('Archivo local inexistente');
      }

      await FileSystem.openDocumentAsync(file.local_path);
    },
    []
  );

  // ---- cleanup ----
  const clearAllFiles = useCallback(async () => {
    const db = await getDb();

    await FileSystem.deleteAsync(FILES_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true });

    await db.execAsync(`
      DELETE FROM entity_files;
      DELETE FROM files;
    `);
  }, [getDb]);

  const clearLocalFiles = useCallback(async () => {
    await clearAllFiles();
  }, [clearAllFiles]);

  return (
    <FilesContext.Provider
      value={{
        getFilesForEntity,
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
