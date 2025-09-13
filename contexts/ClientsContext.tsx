import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AuthContext } from '@/contexts/AuthContext';
import {
  Client,
  QueueItem,
  loadClientsAction,
  addClientAction,
  updateClientAction,
  deleteClientAction,
  processQueueAction,
  clearQueueAction,
  removeQueueItemAction,
  clearDatabasesAction,
  loadQueueAction,
  initClientSync,
} from '@/actions/clientsActions';

export type { Client, QueueItem } from '@/actions/clientsActions';

interface ClientsContextValue {
  clients: Client[];
  queue: QueueItem[];
  loadClients: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'version'>) => Promise<Client | null>;
  updateClient: (id: number, client: Omit<Client, 'id' | 'version'>) => Promise<boolean>;
  deleteClient: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  removeQueueItem: (id: number) => Promise<void>;
  clearDatabases: () => Promise<void>;
}

export const ClientsContext = createContext<ClientsContextValue>({
  clients: [],
  queue: [],
  loadClients: async () => {},
  addClient: async () => null,
  updateClient: async () => false,
  deleteClient: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
  removeQueueItem: async () => {},
  clearDatabases: async () => {},
});

export const ClientsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    await loadQueueAction(setQueue);
  };

  useEffect(() => {
    initClientSync();
    loadQueue();
  }, []);

  const loadClients = async () => {
    if (!token) return;
    await loadClientsAction(token, setClients);
  };

  const processQueue = async () => {
    if (!token) return;
    await processQueueAction(token, setClients, loadQueue);
  };

  const addClient = async (
    clientData: Omit<Client, 'id' | 'version'>
  ): Promise<Client | null> => {
    const result = await addClientAction(token!, clientData, setClients);
    await loadQueue();
    await processQueue();
    return result;
  };

  const updateClient = async (
    id: number,
    clientData: Omit<Client, 'id' | 'version'>
  ): Promise<boolean> => {
    const ok = await updateClientAction(id, clientData, setClients);
    await loadQueue();
    await processQueue();
    return ok;
    };

  const deleteClient = async (id: number): Promise<boolean> => {
    const ok = await deleteClientAction(id, setClients);
    await loadQueue();
    await processQueue();
    return ok;
  };

  const clearQueue = async (): Promise<void> => {
    await clearQueueAction(setQueue);
  };

  const removeQueueItem = async (id: number): Promise<void> => {
    await removeQueueItemAction(id, setQueue);
  };

  const clearDatabases = async (): Promise<void> => {
    await clearDatabasesAction(setClients, setQueue);
  };

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadClients();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadClients().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <ClientsContext.Provider
      value={{
        clients,
        queue,
        loadClients,
        addClient,
        updateClient,
        deleteClient,
        processQueue,
        clearQueue,
        removeQueueItem,
        clearDatabases,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
};
