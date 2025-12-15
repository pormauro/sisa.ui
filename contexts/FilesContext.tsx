import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  CachedFileRecord,
  getFileMetadata as getCachedMetadata,
  markFileAsMissing,
  removeAllFiles,
  upsertFileMetadata,
} from '@/database/fileCache';
import { initializeDatabase } from '@/database/sqlite';
import { fileStorage } from '@/utils/files/storage';

// Tipo de archivo que devuelve el backend
export interface FileData {
  id: number;
  user_id: number;
  original_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

type CachedFileMeta = FileData & { localUri: string | null; storagePath?: string | null; downloaded?: boolean };

interface FileContextType {
  uploadFile: (
    fileUri: string,
    originalName: string,
    fileType: string,
    fileSize: number
  ) => Promise<FileData | null>;
  getFile: (fileId: number) => Promise<string | null>;
  getFileMetadata: (
    fileId: number
  ) => Promise<CachedFileMeta | null>;
  clearLocalFiles: () => Promise<void>;
}

export const FileContext = createContext<FileContextType>({
  uploadFile: async () => null,
  getFile: async () => null,
  getFileMetadata: async () => null,
  clearLocalFiles: async () => {},
});

interface FileProviderProps {
  children: ReactNode;
}

export const FilesProvider = ({ children }: FileProviderProps) => {
  const { token, isOffline } = useContext(AuthContext);
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => setDatabaseReady(true))
      .catch(error => {
        console.error('Error initializing database', error);
        Alert.alert('Error', 'No se pudo preparar el almacenamiento local.');
      });
  }, []);

  const ensureDatabase = async (): Promise<void> => {
    if (databaseReady) return;
    await initializeDatabase();
    setDatabaseReady(true);
  };

  const sanitizeFileName = (name: string): string =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const ensureFilesDirectory = async (): Promise<string> => {
    const baseDirectory = `${fileStorage.documentDirectory}files/`;
    if (Platform.OS !== 'web') {
      try {
        await FileSystem.makeDirectoryAsync(baseDirectory, { intermediates: true });
      } catch (error: any) {
        if (!String(error?.message || '').includes('already exists')) {
          console.log('Error creating files directory', error);
        }
      }
    }
    return baseDirectory;
  };

  const buildStoragePath = async (fileId: number, mimeType: string): Promise<string> => {
    const baseDirectory = await ensureFilesDirectory();
    const extension = mimeType.split('/').pop() || 'bin';
    return `${baseDirectory}${fileId}.${extension}`;
  };

  const resolveLocalUri = async (record: CachedFileRecord): Promise<string | null> => {
    if (!record.localPath) return null;

    const base64 = await fileStorage.read(record.localPath, record.mime);
    if (base64) {
      if (Platform.OS === 'web') {
        return `data:${record.mime};base64,${base64}`;
      }
      return record.localPath;
    }

    await markFileAsMissing(record.id);
    return null;
  };

  const getFile = async (fileId: number): Promise<string | null> => {
    try {
      await ensureDatabase();
      const meta = await getCachedMetadata(fileId);

      if (meta && meta.downloaded) {
        const localUri = await resolveLocalUri(meta);
        if (localUri) {
          return localUri;
        }
      }

      if (isOffline) {
        Alert.alert('No disponible sin conexión', 'El archivo no está guardado localmente.');
        return null;
      }

      const response = await fetch(`${BASE_URL}/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const contentType =
          response.headers.get('Content-Type') || 'application/octet-stream';
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(
          /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i
        );
        let originalName = `file_${fileId}`;
        if (match) {
          try {
            originalName = decodeURIComponent(match[1] || match[2]);
          } catch {
            originalName = match[1] || match[2];
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const storagePath = await buildStoragePath(fileId, contentType);

        const file: FileData = {
          id: fileId,
          user_id: 0,
          original_name: sanitizeFileName(originalName),
          file_type: contentType,
          file_size: arrayBuffer.byteLength,
          created_at: meta?.created_at || new Date().toISOString(),
          updated_at: meta?.updated_at || new Date().toISOString(),
        };

        await fileStorage.write(storagePath, base64, contentType);
        await upsertFileMetadata({
          id: file.id,
          name: file.original_name,
          mime: file.file_type,
          size: file.file_size,
          checksum: null,
          localPath: storagePath,
          downloaded: true,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        });
        const localUri = Platform.OS === 'web'
          ? `data:${contentType};base64,${base64}`
          : storagePath;
        return localUri;
      }

      Alert.alert('Error', 'No se pudo descargar el archivo.');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', error.message);
    }
    return null;
  };
  

  const uploadFile = async (
    fileUri: string,
    originalName: string,
    fileType: string,
    fileSize: number
  ): Promise<FileData | null> => {
    try {
      await ensureDatabase();
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
        Alert.alert('Error', 'Error al subir el archivo.');
        return null;
      }

      const data = await response.json();
      if (data.file) {
        const storagePath = await buildStoragePath(data.file.id, fileType);
        const { uri } = await fileStorage.copy(fileUri, storagePath, fileType);
        const localUri = Platform.OS === 'web' ? uri : storagePath;
        await upsertFileMetadata({
          id: data.file.id,
          name: data.file.original_name,
          mime: data.file.file_type ?? fileType,
          size: data.file.file_size ?? fileSize,
          checksum: data.file.checksum ?? null,
          localPath: storagePath,
          downloaded: true,
          createdAt: data.file.created_at ?? new Date().toISOString(),
          updatedAt: data.file.updated_at ?? new Date().toISOString(),
        });
        return data.file;
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', error.message);
    }
    return null;
  };

  const getFileMetadata = async (
    fileId: number
  ): Promise<CachedFileMeta | null> => {
    await ensureDatabase();
    const record = await getCachedMetadata(fileId);
    if (record) {
      return {
        id: record.id,
        user_id: 0,
        original_name: record.name,
        file_type: record.mime,
        file_size: record.size,
        created_at: record.createdAt ?? '',
        updated_at: record.updatedAt ?? '',
        localUri: record.localPath ?? null,
        storagePath: record.localPath ?? null,
        downloaded: record.downloaded,
      };
    }
    if (isOffline) {
      return null;
    }
    await getFile(fileId);
    const refreshed = await getCachedMetadata(fileId);
    return refreshed
      ? {
          id: refreshed.id,
          user_id: 0,
          original_name: refreshed.name,
          file_type: refreshed.mime,
          file_size: refreshed.size,
          created_at: refreshed.createdAt ?? '',
          updated_at: refreshed.updatedAt ?? '',
          localUri: refreshed.localPath ?? null,
          storagePath: refreshed.localPath ?? null,
          downloaded: refreshed.downloaded,
        }
      : null;
  };
  const clearLocalFiles = async (): Promise<void> => {
    const existing = await removeAllFiles();
    await Promise.all(
      existing.map(async meta => {
        if (meta.localPath) {
          await fileStorage.delete(meta.localPath);
        }
      })
    );
  };

  return (
    <FileContext.Provider value={{ uploadFile, getFile, getFileMetadata, clearLocalFiles }}>
      {children}
    </FileContext.Provider>
  );
};

export default FilesProvider;
