import React, { createContext, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

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
  ) => Promise<(FileData & { localUri: string }) | null>;
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

  const fileMetaKey = (id: number): string => `file_meta_${id}`;

  const saveFileLocally = async (
    fileId: number,
    base64: string,
    file: FileData
  ): Promise<string> => {
    const extension = file.file_type.split('/').pop() || 'bin';
    const localUri = `${FileSystem.documentDirectory}file_${fileId}.${extension}`;
    await FileSystem.writeAsStringAsync(localUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await AsyncStorage.setItem(
      fileMetaKey(fileId),
      JSON.stringify({ ...file, localUri })
    );
    return localUri;
  };

  const getFile = async (fileId: number): Promise<string | null> => {
    try {
      const metaString = await AsyncStorage.getItem(fileMetaKey(fileId));
      if (metaString) {
        const meta = JSON.parse(metaString) as FileData & { localUri: string };
        const info = await FileSystem.getInfoAsync(meta.localUri);
        if (info.exists) {
          const base64 = await FileSystem.readAsStringAsync(meta.localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `data:${meta.file_type};base64,${base64}`;
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

        await saveFileLocally(fileId, base64, file);
        return `data:${contentType};base64,${base64}`;
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
        const localUri = `${FileSystem.documentDirectory}file_${data.file.id}.${extension}`;
        await FileSystem.copyAsync({ from: fileUri, to: localUri });
        await AsyncStorage.setItem(
          fileMetaKey(data.file.id),
          JSON.stringify({ ...data.file, localUri })
        );
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
  ): Promise<(FileData & { localUri: string }) | null> => {
    const metaString = await AsyncStorage.getItem(fileMetaKey(fileId));
    if (metaString) {
      return JSON.parse(metaString) as FileData & { localUri: string };
    }
    await getFile(fileId);
    const newMeta = await AsyncStorage.getItem(fileMetaKey(fileId));
    if (newMeta) {
      return JSON.parse(newMeta) as FileData & { localUri: string };
    }
    return null;
  };
  const clearLocalFiles = async (): Promise<void> => {
    const keys = await AsyncStorage.getAllKeys();
    const fileKeys = keys.filter(k => k.startsWith('file_meta_'));
    const metas = await AsyncStorage.multiGet(fileKeys);
    await Promise.all(
      metas.map(async ([, value]) => {
        if (value) {
          const meta = JSON.parse(value) as { localUri: string };
          await FileSystem.deleteAsync(meta.localUri, { idempotent: true });
        }
      })
    );
    await AsyncStorage.multiRemove(fileKeys);
  };

  return (
    <FileContext.Provider value={{ uploadFile, getFile, getFileMetadata, clearLocalFiles }}>
      {children}
    </FileContext.Provider>
  );
};

export default FilesProvider;
