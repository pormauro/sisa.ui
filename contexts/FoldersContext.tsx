// Archivo: contexts/FoldersContext.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  folder_image_file_id: string | null;
  client_id: number;
  user_id: number;
}

export type FolderInput = {
  name: string;
  client_id: number;
  parent_id: number | null;
  folder_image_file_id: string | null;
};

interface FoldersContextType {
  folders: Folder[];
  loadFolders: () => void;
  addFolder: (folder: FolderInput) => Promise<number | null>;
  updateFolder: (id: number, folder: FolderInput) => Promise<boolean>;
  deleteFolder: (id: number) => Promise<boolean>;
}

export const FoldersContext = createContext<FoldersContextType>({
  folders: [],
  loadFolders: () => {},
  addFolder: async () => null,
  updateFolder: async () => false,
  deleteFolder: async () => false,
});

export const FoldersProvider = ({ children }: { children: ReactNode }) => {
  const [folders, setFolders] = useCachedState<Folder[]>('folders', []);
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const loadFolders = useCallback(async () => {
    if (!permissions.includes('listFolders')) return;
    try {
      const response = await fetch(`${BASE_URL}/folders`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    }
  }, [permissions, setFolders, token]);

  const addFolder = async (folderData: FolderInput): Promise<number | null> => {
    if (!permissions.includes('addFolder')) return null;
    try {
      const response = await fetch(`${BASE_URL}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(folderData),
      });
      const data = await response.json();
      const newIdRaw =
        data.folder_id != null
          ? data.folder_id
          : data.folder && data.folder.id != null
            ? data.folder.id
            : null;
      if (newIdRaw != null) {
        await loadFolders();
        const numericId = Number(newIdRaw);
        return Number.isNaN(numericId) ? null : numericId;
      }
    } catch (error) {
      console.error("Error adding folder:", error);
    }
    return null;
  };

  const updateFolder = async (id: number, folderData: FolderInput): Promise<boolean> => {
    if (!permissions.includes('updateFolder')) return false;
    try {
      const response = await fetch(`${BASE_URL}/folders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(folderData),
      });
      const data = await response.json();
      if (data.message === 'Folder updated successfully') {
        await loadFolders();
        return true;
      }
    } catch (error) {
      console.error("Error updating folder:", error);
    }
    return false;
  };

  const deleteFolder = async (id: number): Promise<boolean> => {
    if (!permissions.includes('deleteFolder')) return false;
    try {
      const response = await fetch(`${BASE_URL}/folders/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Folder deleted successfully') {
        await loadFolders();
        return true;
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      void loadFolders();
    }
  }, [loadFolders, permissions, token]);

  return (
    <FoldersContext.Provider value={{ folders, loadFolders, addFolder, updateFolder, deleteFolder }}>
      {children}
    </FoldersContext.Provider>
  );
};
