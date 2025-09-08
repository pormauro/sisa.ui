import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalCategoriesTable,
  getAllCategoriesLocal,
  clearLocalCategories,
  insertCategoryLocal,
} from '@/src/database/categoriesLocalDB';

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  type: 'income' | 'expense';
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

interface CategoriesContextValue {
  categories: Category[];
  queue: QueueItem[];
  loadCategories: () => void;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | null>;
  updateCategory: (id: number, category: Omit<Category, 'id'>) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  queue: [],
  loadCategories: () => {},
  addCategory: async () => null,
  updateCategory: async () => false,
  deleteCategory: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalCategoriesTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchCategories = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localCategories = await getAllCategoriesLocal();
      setCategories(localCategories as Category[]);
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchCategories(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/categories`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.categories) {
        await clearLocalCategories();
        for (const category of data.categories) {
          await insertCategoryLocal(category);
        }
        setCategories(data.categories);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading categories:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchCategories(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar las categorías.');
      }
    }
  };

  const loadCategories = async () => {
    await fetchCategories();
  };

  const addCategory = async (categoryData: Omit<Category, 'id'>): Promise<Category | null> => {
    const tempId = Date.now() * -1;
    const newCategory: Category = { id: tempId, ...categoryData, syncStatus: 'pending' };
    setCategories(prev => [...prev, newCategory]);
    await enqueueOperation('categories', 'create', categoryData, null, tempId);
    await loadQueue();
    processQueue();
    return newCategory;
  };

  const updateCategory = async (id: number, categoryData: Omit<Category, 'id'>): Promise<boolean> => {
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, ...categoryData, syncStatus: 'pending' } : c))
    );
    await enqueueOperation('categories', 'update', categoryData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteCategory = async (id: number): Promise<boolean> => {
    setCategories(prev =>
      prev.map(c =>
        c.id === id ? { ...c, pendingDelete: true, syncStatus: 'pending' } : c
      )
    );
    await enqueueOperation('categories', 'delete', {}, id, null);
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
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (item.table_name === 'categories') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/categories`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.category_id, 10);
              setCategories(prev =>
                prev.map(c =>
                  c.id === item.local_temp_id ? { ...c, id: newId, syncStatus: undefined } : c
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/categories/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setCategories(prev =>
                prev.map(c =>
                  c.id === item.record_id ? { ...c, ...payload, syncStatus: undefined } : c
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/categories/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setCategories(prev => prev.filter(c => c.id !== item.record_id));
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
        await loadCategories();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadCategories().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        queue,
        loadCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        processQueue,
        clearQueue,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
};

