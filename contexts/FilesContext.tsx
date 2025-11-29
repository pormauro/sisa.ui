import React, { createContext, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { getCachedFileMeta, setCachedFileMeta } from '@/utils/cache';
import { fileStorage } from '@/utils/files/storage';
import { clearLocalFileStorage } from '@/utils/files/cleanup';

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

type CachedFileMeta = FileData & { localUri: string; storagePath?: string };

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
  const { token } = useContext(AuthContext);

  const sanitizeFileName = (name: string): string =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const saveFileLocally = async (
    fileId: number,
    base64: string,
    file: FileData
  ): Promise<string> => {
    const extension = file.file_type.split('/').pop() || 'bin';
    const defaultName = `file_${fileId}.${extension}`;
    const sanitized = sanitizeFileName(file.original_name || defaultName);
    const storagePath = `${fileStorage.documentDirectory}${sanitized}`;
    const { uri } = await fileStorage.write(storagePath, base64, file.file_type);
    const localUri = Platform.OS === 'web' ? uri : storagePath;
    const cachedMeta: CachedFileMeta = {
      ...file,
      localUri,
      storagePath,
    };
    await setCachedFileMeta(fileId, cachedMeta);
    return localUri;
  };

  const getFile = async (fileId: number): Promise<string | null> => {
    try {
      const meta = await getCachedFileMeta<CachedFileMeta>(fileId);
      const target = meta?.storagePath ?? meta?.localUri;
      if (meta && target) {
        const base64 = await fileStorage.read(target, meta.file_type);
        if (base64 !== null) {
          if (Platform.OS === 'web') {
            const dataUri = `data:${meta.file_type};base64,${base64}`;
            if (meta.localUri !== dataUri) {
              await setCachedFileMeta(fileId, { ...meta, localUri: dataUri, storagePath: target });
            }
            return dataUri;
          }
          return meta.localUri || target;
        }
        if (Platform.OS === 'web' && meta.localUri?.startsWith('data:')) {
          return meta.localUri;
        }
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

        const file: FileData = {
          id: fileId,
          user_id: 0,
          original_name: originalName,
          file_type: contentType,
          file_size: arrayBuffer.byteLength,
          created_at: '',
          updated_at: '',
        };

        const localUri = await saveFileLocally(fileId, base64, file);
        if (Platform.OS === 'web') {
          return `data:${contentType};base64,${base64}`;
        }
        return localUri;
      } else {
        Alert.alert('Error', 'No se pudo descargar el archivo.');
      }
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
        const extension = fileType.split('/').pop() || 'bin';
        const defaultName = `file_${data.file.id}.${extension}`;
        const sanitized = sanitizeFileName(
          data.file.original_name || defaultName
        );
        const storagePath = `${fileStorage.documentDirectory}${sanitized}`;
        const { uri } = await fileStorage.copy(fileUri, storagePath, fileType);
        const localUri = Platform.OS === 'web' ? uri : storagePath;
        const cachedMeta: CachedFileMeta = {
          ...data.file,
          localUri,
          storagePath,
        };
        await setCachedFileMeta(data.file.id, cachedMeta);
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
    const meta = await getCachedFileMeta<CachedFileMeta>(fileId);
    if (meta) {
      return meta;
    }
    await getFile(fileId);
    const newMeta = await getCachedFileMeta<CachedFileMeta>(fileId);
    if (newMeta) {
      return newMeta;
    }
    return null;
  };
  const clearLocalFiles = async (): Promise<void> => {
    await clearLocalFileStorage();
  };

  return (
    <FileContext.Provider value={{ uploadFile, getFile, getFileMetadata, clearLocalFiles }}>
      {children}
    </FileContext.Provider>
  );
};

export default FilesProvider;
