// src/contexts/ConfigContext.tsx
import React, { createContext, useState, ReactNode, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  createSyncQueueTable,
  enqueueOperation,
  getAllQueueItems,
  deleteQueueItem,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalConfigTable,
  getConfigLocal,
  saveConfigLocal,
} from '@/src/database/configLocalDB';

export interface ConfigDetails {
  role: string;
  view_type: string;
  theme: string;
  font_size: string;
}

export interface ConfigForm {
  role: string;
  view_type: string;
  theme: string;
  font_size: string;
}

interface ConfigContextType {
  configDetails: ConfigDetails | null;
  loadConfig: () => Promise<void>;
  updateConfig: (configForm: ConfigForm) => Promise<void>;
  processQueue: () => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configDetails, setConfigDetails] = useState<ConfigDetails | null>(null);
  const { userId, token } = useContext(AuthContext);

  useEffect(() => {
    createSyncQueueTable();
    createLocalConfigTable();
  }, []);

  const loadConfig = async (): Promise<void> => {
    if (!userId || !token) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const local = await getConfigLocal();
      if (local) {
        setConfigDetails(local as ConfigDetails);
      }
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const configuration = data.configuration as ConfigDetails;
        setConfigDetails(configuration);
        await saveConfigLocal(configuration);
      } else {
        console.log('Error al obtener la configuración');
      }
    } catch (error: any) {
      console.log('Error en fetch de configuración:', error);
      const local = await getConfigLocal();
      if (local) {
        setConfigDetails(local as ConfigDetails);
      }
    }
  };

  const updateConfig = async (configForm: ConfigForm): Promise<void> => {
    if (!token) return;
    const merged = configDetails ? { ...configDetails, ...configForm } : configForm;
    setConfigDetails(merged);
    await saveConfigLocal(merged);
    await enqueueOperation('user_configurations', 'update', configForm, null, null);
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      await processQueue();
    } else {
      console.log('Sin conexión: La operación se encoló y se sincronizará cuando vuelva la conexión.');
    }
  };

  const processQueue = async () => {
    if (!token) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      if (item.table_name === 'user_configurations' && item.op === 'update') {
        try {
          const response = await fetch(`${BASE_URL}/user_configurations`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: item.payload_json,
          });
          if (response.ok) {
            const payload = JSON.parse(item.payload_json);
            setConfigDetails(prev => (prev ? { ...prev, ...payload } : payload));
            await saveConfigLocal(payload);
            await deleteQueueItem(item.id);
          } else {
            await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
          }
        } catch (err: any) {
          await updateQueueItemStatus(item.id, 'error', String(err));
        }
      }
    }
  };

  useEffect(() => {
    if (userId && token) {
      void loadConfig();
      processQueue();
      const unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
          processQueue().catch(() => {});
        }
      });
      return () => unsubscribe();
    }
  }, [userId, token]);

  return (
    <ConfigContext.Provider value={{ configDetails, loadConfig, updateConfig, processQueue }}>
      {children}
    </ConfigContext.Provider>
  );
};
