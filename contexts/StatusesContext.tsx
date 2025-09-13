// contexts/StatusesContext.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  createSyncQueueTable,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
  deleteQueueItem,
} from '@/src/database/syncQueueDB';
import 'react-native-get-random-values';
import {
  createLocalStatusesTable,
  getAllStatusesLocal,
  insertStatusLocal,
  updateStatusLocal,
  deleteStatusLocal,
  clearLocalStatuses,
} from '@/src/database/statusesLocalDB';
import { getMaxHistoryId, setMaxHistoryId } from '@/src/utils/syncHistory';

export interface Status {
  id: number;
  label: string;
  value: string;
  background_color: string;
  order_index: number;
  version: number;
  created_at?: string;
  updated_at?: string;
  syncStatus?: 'pending' | 'error';
  pendingDelete?: boolean;
}

interface StatusesContextType {
  statuses: Status[];
  loadStatuses: () => void;
  addStatus: (
    status: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ) => Promise<Status | null>;
  updateStatus: (
    id: number,
    status: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ) => Promise<boolean>;
  deleteStatus: (id: number) => Promise<boolean>;
  reorderStatuses: (orderedIds: number[]) => Promise<boolean>;
}

export const StatusesContext = createContext<StatusesContextType>({
  statuses: [],
  loadStatuses: () => {},
  addStatus: async () => null,
  updateStatus: async () => false,
  deleteStatus: async () => false,
  reorderStatuses: async () => false,
});

export const StatusesProvider = ({ children }: { children: ReactNode }) => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const { token } = useContext(AuthContext);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const loadStatuses = useCallback(async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localStatuses = await getAllStatusesLocal();
      setStatuses(prev => {
        const pending = prev.filter(s => s.syncStatus === 'pending');
        return [...(localStatuses as Status[]), ...pending];
      });
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => loadStatuses(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/statuses`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.statuses) {
        const loaded: Status[] = data.statuses.map((s: any) => ({
          ...s,
          version: s.version ?? 1,
        }));
        setStatuses(prev => {
          const pending = prev.filter(s => s.syncStatus === 'pending');
          return [...loaded, ...pending];
        });
        await clearLocalStatuses();
        for (const s of loaded) {
          await insertStatusLocal(s);
        }
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  }, [token]);

  const addStatus = async (
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ): Promise<Status | null> => {
    const requestId =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const tempId = Date.now();
      const newStatus: Status = {
        id: tempId,
        version: 1,
        ...statusData,
        syncStatus: 'pending',
      };
      setStatuses(prev => [...prev, newStatus]);
      await insertStatusLocal(newStatus);
      await enqueueOperation('statuses', 'create', statusData, null, tempId, requestId);
      return newStatus;
    }

    const batchId = `${Date.now()}-${Math.random()}`;
    try {
      const sinceHistoryId = await getMaxHistoryId();
      const payload = {
        batch_id: batchId,
        ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
        ops: [
          {
            request_id: requestId,
            entity: 'statuses',
            op: 'create',
            local_id: 1,
            data: statusData,
          },
        ],
      };
      const response = await fetch(`${BASE_URL}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': batchId,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.history?.max_history_id !== undefined) {
          await setMaxHistoryId(data.history.max_history_id);
        }
        const result = data.results?.[0];
        if (data.ok && result?.status === 'done') {
          const newStatus: Status = {
            id: result.remote_id,
            version: result.version ?? 1,
            ...statusData,
          };
          setStatuses(prev => [...prev, newStatus]);
          await insertStatusLocal(newStatus);
          return newStatus;
        }
      }
    } catch (error) {
      console.error('Error adding status:', error);
    }
    return null;
  };

  const updateStatus = async (
    id: number,
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ): Promise<boolean> => {
    const current = statuses.find(s => s.id === id);
    const version = current?.version ?? 1;
    const state = await NetInfo.fetch();
    const requestId =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    if (!state.isConnected) {
      setStatuses(prev =>
        prev.map(s =>
          s.id === id ? { ...s, ...statusData, syncStatus: 'pending' } : s
        )
      );
      await updateStatusLocal(id, { ...statusData, version });
      await enqueueOperation(
        'statuses',
        'update',
        { ...statusData, if_match_version: version },
        id,
        null,
        requestId
      );
      return true;
    }

    const batchId = `${Date.now()}-${Math.random()}`;
    try {
      const sinceHistoryId = await getMaxHistoryId();
      const payload = {
        batch_id: batchId,
        ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
        ops: [
          {
            request_id: requestId,
            entity: 'statuses',
            op: 'update',
            remote_id: id,
            if_match_version: version,
            data: statusData,
          },
        ],
      };
      const response = await fetch(`${BASE_URL}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': batchId,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.history?.max_history_id !== undefined) {
          await setMaxHistoryId(data.history.max_history_id);
        }
        const result = data.results?.[0];
        if (data.ok && result?.status === 'done') {
          const newVersion = result.version ?? version;
          setStatuses(prev =>
            prev.map(s => (s.id === id ? { ...s, ...statusData, version: newVersion } : s))
          );
          await updateStatusLocal(id, { ...statusData, version: newVersion });
          return true;
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
    return false;
  };

  const deleteStatus = async (id: number): Promise<boolean> => {
    const state = await NetInfo.fetch();
    const requestId =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    if (!state.isConnected) {
      setStatuses(prev =>
        prev.map(s =>
          s.id === id ? { ...s, pendingDelete: true, syncStatus: 'pending' } : s
        )
      );
      await deleteStatusLocal(id);
      await enqueueOperation('statuses', 'delete', {}, id, null, requestId);
      return true;
    }

    const batchId = `${Date.now()}-${Math.random()}`;
    try {
      const sinceHistoryId = await getMaxHistoryId();
      const payload = {
        batch_id: batchId,
        ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
        ops: [
          {
            request_id: requestId,
            entity: 'statuses',
            op: 'delete',
            remote_id: id,
          },
        ],
      };
      const response = await fetch(`${BASE_URL}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': batchId,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.history?.max_history_id !== undefined) {
          await setMaxHistoryId(data.history.max_history_id);
        }
        const result = data.results?.[0];
        if (data.ok && result?.status === 'done') {
          setStatuses(prev => prev.filter(s => s.id !== id));
          await deleteStatusLocal(id);
          return true;
        }
      }
    } catch (error) {
      console.error('Error deleting status:', error);
    }
    return false;
  };

  const processQueue = useCallback(async () => {
    if (!token) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      try {
        if (item.table_name === 'statuses') {
          const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          };
          const batchId = `${Date.now()}-${Math.random()}`;
          let op: any = {
            request_id: item.request_id,
            entity: 'statuses',
            op: item.op,
          };
          const payload = JSON.parse(item.payload_json);
          if (item.op === 'create') {
            op.local_id = item.local_temp_id;
            op.data = payload;
          } else if (item.op === 'update') {
            op.remote_id = item.record_id;
            op.if_match_version = payload.if_match_version;
            const { if_match_version, ...rest } = payload;
            op.data = rest;
          } else if (item.op === 'delete') {
            op.remote_id = item.record_id;
          }
          const sinceHistoryId = await getMaxHistoryId();
          const bodyPayload = {
            batch_id: batchId,
            ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
            ops: [op],
          };
          const response = await fetch(`${BASE_URL}/sync/batch`, {
            method: 'POST',
            headers: { ...headers, 'Idempotency-Key': batchId },
            body: JSON.stringify(bodyPayload),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.history?.max_history_id !== undefined) {
              await setMaxHistoryId(data.history.max_history_id);
            }
            const result = data.results?.[0];
            if (data.ok && result?.status === 'done') {
              if (item.op === 'create') {
                const newId = result.remote_id;
                const version = result.version ?? 1;
                setStatuses(prev =>
                  prev.map(s =>
                    s.id === item.local_temp_id
                      ? { ...s, id: newId, version, syncStatus: undefined }
                      : s
                  )
                );
                await deleteStatusLocal(item.local_temp_id);
                await insertStatusLocal({ id: newId, ...payload, version });
              } else if (item.op === 'update') {
                const version = result.version ?? payload.if_match_version;
                const { if_match_version, ...rest } = payload;
                setStatuses(prev =>
                  prev.map(s =>
                    s.id === item.record_id
                      ? { ...s, ...rest, version, syncStatus: undefined }
                      : s
                  )
                );
                await updateStatusLocal(item.record_id, { ...rest, version });
              } else if (item.op === 'delete') {
                setStatuses(prev => prev.filter(s => s.id !== item.record_id));
              }
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', 'Invalid response');
              break;
            }
          } else {
            await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
            break;
          }
        }
      } catch (err: any) {
        await updateQueueItemStatus(item.id, 'error', String(err));
        break;
      }
    }
  }, [token]);

  const reorderStatuses = async (orderedIds: number[]): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/statuses/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const data = await response.json();
      if (data.message === 'Statuses reordered successfully') {
        await loadStatuses();
        return true;
      }
    } catch (error) {
      console.error("Error reordering statuses:", error);
    }
    return false;
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalStatusesTable();
  }, []);

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch {}
      try {
        await loadStatuses();
      } catch {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadStatuses().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token, processQueue, loadStatuses]);

  return (
    <StatusesContext.Provider
      value={{ statuses, loadStatuses, addStatus, updateStatus, deleteStatus, reorderStatuses }}
    >
      {children}
    </StatusesContext.Provider>
  );
};
