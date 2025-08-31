import React, { createContext, useContext, ReactNode, useState } from 'react';
import { Alert } from 'react-native';
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
  getFileMetadata: (fileId: number) => Promise<FileData | null>;
  blobToBase64: (blob: Blob) => Promise<string>;
}

export const FileContext = createContext<FileContextType>({
  uploadFile: async () => null,
  getFile: async () => null,
  getFileMetadata: async () => null,
  blobToBase64: async () => '',
});

interface FileProviderProps {
  children: ReactNode;
}

export const FilesProvider = ({ children }: FileProviderProps) => {
  const { token } = useContext(AuthContext);
  const [cachedFiles, setCachedFiles] = useState<{ [key: number]: Blob }>({});

  const downloadFile = async (fileId: number): Promise<Blob | null> => {
    try {
      const response = await fetch(`${BASE_URL}/files/${fileId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.content) {
          const byteCharacters = atob(json.content);
          const byteArrays = [];
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArrays.push(byteCharacters.charCodeAt(i));
          }
          const blob = new Blob([new Uint8Array(byteArrays)], {
            type: json.file.file_type,
          });
          setCachedFiles(prev => ({ ...prev, [fileId]: blob }));
          return blob;
        }
      } else {
        Alert.alert('Error', 'Error al descargar el archivo.');
      }
    } catch (error: any) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', error.message);
    }
    return null;
  };

  const getFile = async (fileId: number): Promise<string | null> => {
    try {
      const response = await fetch(`${BASE_URL}/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.ok) {
        const json = await response.json();
        if (json.content && json.file?.file_type) {
          return `data:${json.file.file_type};base64,${json.content}`;
        }
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
      if (data.file) return data.file;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', error.message);
    }
    return null;
  };

  const getFileMetadata = async (fileId: number): Promise<FileData | null> => {
    try {
      const response = await fetch(`${BASE_URL}/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const json = await response.json();
        return json.file || null;
      }
    } catch (error: any) {
      console.error('Error getting file metadata:', error);
    }
    return null;
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <FileContext.Provider value={{ uploadFile, getFile, getFileMetadata, blobToBase64 }}>
      {children}
    </FileContext.Provider>
  );
};

export default FilesProvider;
