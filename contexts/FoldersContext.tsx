// Archivo: contexts/FoldersContext.tsx

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalFoldersTable,
  getAllFoldersLocal,
  clearLocalFolders,
  insertFolderLocal,
} from '@/src/database/foldersLocalDB';
import { mergeOfflineData } from '@/utils/offline';

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  folder_image_file_id: string | null;
  client_id: number;
  user_id: number;
  syncStatus?: 'pending' | 'error';
  pendingDelete?: boolean;
}

export interface QueueItem {
  id: number;
  table_name: string;
  op: string;
  record_id: number | null;
  local_temp_id: number | null;
  payload_json: string;
  status: string;
  last_error?: string | null;
}

export type FolderInput = {
  name: string;
  client_id: number;
  parent_id: number | null;
  folder_image_file_id: string | null;
};

interface FoldersContextType {
  folders: Folder[];
  queue: QueueItem[];
  loadFolders: () => void;
  addFolder: (folder: FolderInput) => Promise<boolean>;
  updateFolder: (id: number, folder: FolderInput) => Promise<boolean>;
  deleteFolder: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const FoldersContext = createContext<FoldersContextType>({
  folders: [],
  queue: [],
  loadFolders: () => {},
  addFolder: async () => false,
  updateFolder: async () => false,
  deleteFolder: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const FoldersProvider = ({ children }: { children: ReactNode }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalFoldersTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchFolders = async (attempt = 0): Promise<void> => {
    if (!permissions.includes('listFolders')) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localFolders = await getAllFoldersLocal();
      setFolders(prev => mergeOfflineData(localFolders as Folder[], prev));
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchFolders(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/folders`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.folders) {
        await clearLocalFolders();
        for (const folder of data.folders) {
          await insertFolderLocal(folder);
        }
        setFolders(prev => mergeOfflineData(data.folders, prev));
      }
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchFolders(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar las carpetas.');
      }
    }
  };

  const loadFolders = async () => {
    await fetchFolders();
  };

  const addFolder = async (folderData: FolderInput): Promise<boolean> => {
    if (!permissions.includes('addFolder')) return false;
    const tempId = Date.now() * -1;
    const newFolder: Folder = { id: tempId, user_id: 0, ...folderData, syncStatus: 'pending' };
    setFolders(prev => [...prev, newFolder]);
    await enqueueOperation('folders', 'create', folderData, null, tempId);
    await loadQueue();
    processQueue();
    return true;
  };

  const updateFolder = async (id: number, folderData: FolderInput): Promise<boolean> => {
    if (!permissions.includes('updateFolder')) return false;
    setFolders(prev =>
      prev.map(f => (f.id === id ? { ...f, ...folderData, syncStatus: 'pending' } : f))
    );
    await enqueueOperation('folders', 'update', folderData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteFolder = async (id: number): Promise<boolean> => {
    if (!permissions.includes('deleteFolder')) return false;
    setFolders(prev =>
      prev.map(f =>
        f.id === id ? { ...f, pendingDelete: true, syncStatus: 'pending' } : f
      )
    );
    await enqueueOperation('folders', 'delete', {}, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const clearQueue = async (): Promise<void> => {
    await clearQueueDB();
    await loadQueue();
  };

  const processQueue = async () => {
    if (!token) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (item.table_name === 'folders') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/folders`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.folder_id, 10);
              setFolders(prev =>
                prev.map(f =>
                  f.id === item.local_temp_id
                    ? { ...f, id: newId, syncStatus: undefined }
                    : f
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/folders/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setFolders(prev =>
                prev.map(f =>
                  f.id === item.record_id
                    ? { ...f, ...payload, syncStatus: undefined }
                    : f
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/folders/${item.record_id}`, {
              method: 'DELETE',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              setFolders(prev => prev.filter(f => f.id !== item.record_id));
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          }
        }
      } catch (err: any) {
        await updateQueueItemStatus(item.id, 'error', String(err));
        break;
      }
    }
    await loadQueue();
  };

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadFolders();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadFolders().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token, permissions]);

  return (
    <FoldersContext.Provider
      value={{ folders, queue, loadFolders, addFolder, updateFolder, deleteFolder, processQueue, clearQueue }}
    >
      {children}
    </FoldersContext.Provider>
  );
};
