import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { ensureSortedByNewest } from '@/utils/sort';

export type NotificationStatus = 'unread' | 'read' | 'all';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error' | (string & {});

export interface NotificationSource {
  table: string | null;
  id: number | null;
  history_id: number | null;
}

export interface NotificationTimestamps {
  created_at: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  expires_at: string | null;
}

export interface NotificationState {
  is_read: boolean;
  read_at: string | null;
  is_hidden: boolean;
  hidden_at: string | null;
  delivered_in_app: boolean;
  delivered_email: boolean;
  delivered_push: boolean;
  last_delivered_at: string | null;
}

export interface NotificationEntry {
  id: number;
  company_id: number | null;
  company_name: string | null;
  type: string | null;
  title: string;
  body: string;
  source: NotificationSource | null;
  payload: Record<string, unknown> | null;
  severity: NotificationSeverity;
  created_by_user_id: number | null;
  timestamps: NotificationTimestamps;
  state: NotificationState;
}

export interface NotificationFilters {
  status?: NotificationStatus;
  company_id?: number | null;
  limit?: number | null;
  since?: string | null;
}

type NotificationRequest = NotificationFilters & { force?: boolean };

export interface ManualNotificationInput {
  title: string;
  body: string;
  user_id?: number | string | null;
  user_ids?: Array<number | string> | null;
  company_id?: number | string | null;
  type?: string | null;
  severity?: NotificationSeverity;
  source_table?: string | null;
  source_id?: number | string | null;
  source_history_id?: number | string | null;
  payload?: Record<string, unknown> | string | null;
}

interface NotificationsContextValue {
  notifications: NotificationEntry[];
  loading: boolean;
  filters: NotificationFilters;
  loadNotifications: (filters?: NotificationRequest) => Promise<void>;
  markAsRead: (id: number, payload?: { read_at?: string | null }) => Promise<NotificationEntry | null>;
  hideNotification: (
    id: number,
    payload?: { hidden_at?: string | null }
  ) => Promise<NotificationEntry | null>;
  markAllAsRead: (payload?: { company_id?: number | null }) => Promise<number>;
  sendNotification: (
    payload: ManualNotificationInput
  ) => Promise<{ notificationId: number | null; invalidUserIds: number[] }>;
}

const defaultContext: NotificationsContextValue = {
  notifications: [],
  loading: false,
  filters: { status: 'all' },
  loadNotifications: async () => {},
  markAsRead: async () => null,
  hideNotification: async () => null,
  markAllAsRead: async () => 0,
  sendNotification: async () => ({ notificationId: null, invalidUserIds: [] }),
};

export const NotificationsContext = createContext<NotificationsContextValue>(defaultContext);

const parseBooleanFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
};

const parsePayload = (value: unknown): Record<string, unknown> | null => {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { message: trimmed };
    }
  }

  if (typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }

  return { value } as Record<string, unknown>;
};

const parseSource = (value: any): NotificationSource | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const sourceTable = value.table ?? value.source_table ?? null;
  const sourceId = value.id ?? value.source_id ?? null;
  const historyId = value.history_id ?? value.source_history_id ?? null;

  if (!sourceTable && !sourceId && !historyId) {
    return null;
  }

  return {
    table: sourceTable ?? null,
    id: parseNullableNumber(sourceId),
    history_id: parseNullableNumber(historyId),
  };
};

const parseTimestamps = (value: any): NotificationTimestamps => ({
  created_at: value?.created_at ?? value?.timestamps?.created_at ?? null,
  scheduled_at: value?.scheduled_at ?? value?.timestamps?.scheduled_at ?? null,
  sent_at: value?.sent_at ?? value?.timestamps?.sent_at ?? null,
  expires_at: value?.expires_at ?? value?.timestamps?.expires_at ?? null,
});

const parseState = (value: any): NotificationState => ({
  is_read: parseBooleanFlag(value?.is_read ?? value?.state?.is_read ?? false),
  read_at: value?.read_at ?? value?.state?.read_at ?? null,
  is_hidden: parseBooleanFlag(value?.is_hidden ?? value?.state?.is_hidden ?? false),
  hidden_at: value?.hidden_at ?? value?.state?.hidden_at ?? null,
  delivered_in_app: parseBooleanFlag(value?.delivered_in_app ?? value?.state?.delivered_in_app ?? false),
  delivered_email: parseBooleanFlag(value?.delivered_email ?? value?.state?.delivered_email ?? false),
  delivered_push: parseBooleanFlag(value?.delivered_push ?? value?.state?.delivered_push ?? false),
  last_delivered_at: value?.last_delivered_at ?? value?.state?.last_delivered_at ?? null,
});

const normalizeNotification = (raw: any): NotificationEntry => ({
  id: Number(raw?.id ?? raw?.notification_id ?? 0),
  company_id: parseNullableNumber(raw?.company_id ?? raw?.company?.id),
  company_name: parseOptionalString(raw?.company_name ?? raw?.company?.name),
  type: raw?.type ?? raw?.notification_type ?? null,
  title: raw?.title ?? raw?.subject ?? '',
  body: raw?.body ?? raw?.message ?? '',
  source: parseSource(raw?.source ?? raw),
  payload: parsePayload(raw?.payload),
  severity: (raw?.severity ?? raw?.type ?? 'info') as NotificationSeverity,
  created_by_user_id: parseNullableNumber(raw?.created_by_user_id ?? raw?.author_id ?? raw?.user_id),
  timestamps: parseTimestamps(raw),
  state: parseState(raw),
});

const extractNotificationArray = (payload: any): NotificationEntry[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map(normalizeNotification);
  }
  if (Array.isArray(payload.notifications)) {
    return payload.notifications.map(normalizeNotification);
  }
  if (payload.notification) {
    return [normalizeNotification(payload.notification)];
  }
  if (payload.data && Array.isArray(payload.data)) {
    return payload.data.map(normalizeNotification);
  }
  if (payload.id || payload.notification_id) {
    return [normalizeNotification(payload)];
  }
  return [];
};

const extractSingleNotification = (payload: any): NotificationEntry | null => {
  const [first] = extractNotificationArray(payload);
  return first ?? null;
};

const sortNotifications = (items: NotificationEntry[]): NotificationEntry[] => {
  const sanitized = items.filter((item): item is NotificationEntry => Boolean(item));

  return ensureSortedByNewest(
    sanitized,
    item => item.timestamps?.created_at ?? item.timestamps?.sent_at ?? item.timestamps?.scheduled_at,
    item => item.id,
  );
};

const areFiltersEqual = (a: NotificationFilters, b: NotificationFilters): boolean => {
  return (
    (a.status ?? 'all') === (b.status ?? 'all') &&
    (a.company_id ?? null) === (b.company_id ?? null) &&
    (a.limit ?? null) === (b.limit ?? null) &&
    (a.since ?? null) === (b.since ?? null)
  );
};

const MIN_FETCH_INTERVAL_MS = 1000 * 60 * 5; // 5 minutos

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { token, checkConnection } = useContext(AuthContext);
  const [notifications, setNotifications, notificationsHydrated] = useCachedState<NotificationEntry[]>(
    'notifications',
    [],
  );
  const [lastFetchedAt, setLastFetchedAt] = useCachedState<number | null>('notifications.lastFetchedAt', null);
  const [lastAppliedFilters, setLastAppliedFilters] = useCachedState<NotificationFilters>(
    'notifications.lastAppliedFilters',
    { status: 'all' },
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [filters, setFilters] = useState<NotificationFilters>({ status: 'all' });

  useEffect(() => {
    if (!notificationsHydrated) {
      return;
    }
    setNotifications(prev => sortNotifications(prev));
  }, [notificationsHydrated, setNotifications]);

  const authorizedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!token) {
        throw new Error('Missing authentication token');
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
      });
      await ensureAuthResponse(response, { onUnauthorized: checkConnection });
      return response;
    },
    [checkConnection, token],
  );

  const loadNotifications = useCallback(
    async (override?: NotificationRequest) => {
      if (!token) {
        return;
      }
      const { force = false, ...filtersOverride } = override ?? {};
      const mergedFilters: NotificationFilters = { ...filters, ...filtersOverride };
      const isSameFilters = areFiltersEqual(mergedFilters, lastAppliedFilters);
      const lastFetchTime = lastFetchedAt ?? 0;
      const isRecentFetch = Date.now() - lastFetchTime < MIN_FETCH_INTERVAL_MS;

      setFilters(mergedFilters);

      if (!force && isSameFilters && isRecentFetch && notifications.length > 0) {
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (mergedFilters.status) params.append('status', mergedFilters.status);
        if (mergedFilters.company_id) params.append('company_id', String(mergedFilters.company_id));
        if (mergedFilters.limit) params.append('limit', String(mergedFilters.limit));
        if (mergedFilters.since) params.append('since', mergedFilters.since);
        const query = params.toString();
        const response = await authorizedFetch(
          `${BASE_URL}/notifications${query ? `?${query}` : ''}`
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('No se pudieron cargar las notificaciones', data);
          return;
        }
        const parsed = extractNotificationArray(data);
        setNotifications(prev => {
          const mergedById = new Map<number, NotificationEntry>();

          prev.forEach(item => {
            mergedById.set(item.id, item);
          });

          parsed.forEach(item => {
            const existing = mergedById.get(item.id);
            if (existing) {
              mergedById.set(item.id, {
                ...existing,
                ...item,
                state: { ...existing.state, ...item.state },
                timestamps: { ...existing.timestamps, ...item.timestamps },
                source: item.source ?? existing.source,
                payload: item.payload ?? existing.payload,
              });
            } else {
              mergedById.set(item.id, item);
            }
          });

          return sortNotifications(Array.from(mergedById.values()));
        });
        setLastFetchedAt(Date.now());
        setLastAppliedFilters(mergedFilters);
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al listar notificaciones, se solicitará uno nuevo.');
          return;
        }
        console.error('Error al cargar notificaciones', error);
      } finally {
        setLoading(false);
      }
    },
    [
      authorizedFetch,
      filters,
      lastAppliedFilters,
      lastFetchedAt,
      notifications.length,
      setLastAppliedFilters,
      setLastFetchedAt,
      setNotifications,
      token,
    ],
  );

  const mergeNotification = useCallback(
    (updated: NotificationEntry): void => {
      setNotifications(prev => {
        const exists = prev.some(item => item.id === updated.id);
        const next = exists ? prev.map(item => (item.id === updated.id ? updated : item)) : [...prev, updated];
        return sortNotifications(next);
      });
    },
    [setNotifications],
  );

  const markAsRead = useCallback(
    async (
      id: number,
      payload?: { read?: boolean; read_at?: string | null },
    ): Promise<NotificationEntry | null> => {
      try {
        const requestPayload = { read: true, ...payload };
        const optimisticReadAt = requestPayload.read_at ?? new Date().toISOString();

        setNotifications(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  state: { ...item.state, is_read: true, read_at: optimisticReadAt },
                }
              : item,
          ),
        );

        const response = await authorizedFetch(`${BASE_URL}/notifications/${id}/read`, {
          method: 'PATCH',
          body: JSON.stringify(requestPayload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('No fue posible marcar la notificación como leída', data);
          return null;
        }
        const parsed = extractSingleNotification(data);
        if (parsed) {
          mergeNotification(parsed);
          return parsed;
        }
        const fallback: NotificationEntry = {
          id,
          company_id: null,
          company_name: null,
          type: null,
          title: '',
          body: '',
          source: null,
          payload: null,
          severity: 'info',
          created_by_user_id: null,
          timestamps: { created_at: null, expires_at: null, scheduled_at: null, sent_at: null },
          state: { ...parseState(requestPayload ?? {}), is_read: true },
        };
        mergeNotification(fallback);
        return fallback;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al marcar como leída, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error al marcar la notificación como leída', error);
        return null;
      }
    },
    [authorizedFetch, mergeNotification, setNotifications],
  );

  const hideNotification = useCallback(
    async (id: number, payload?: { hidden_at?: string | null }): Promise<NotificationEntry | null> => {
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/${id}/hide`, {
          method: 'PATCH',
          body: JSON.stringify(payload ?? {}),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('No fue posible ocultar la notificación', data);
          return null;
        }
        const parsed = extractSingleNotification(data);
        if (parsed) {
          mergeNotification(parsed);
          return parsed;
        }
        const fallback: NotificationEntry = {
          id,
          company_id: null,
          company_name: null,
          type: null,
          title: '',
          body: '',
          source: null,
          payload: null,
          severity: 'info',
          created_by_user_id: null,
          timestamps: { created_at: null, expires_at: null, scheduled_at: null, sent_at: null },
          state: { ...parseState(payload ?? {}), is_hidden: true },
        };
        mergeNotification(fallback);
        return fallback;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al ocultar la notificación, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error al ocultar la notificación', error);
        return null;
      }
    },
    [authorizedFetch, mergeNotification],
  );

  const markAllAsRead = useCallback(
    async (payload: { company_id?: number | null } = { company_id: 0 }): Promise<number> => {
      try {
        const requestPayload = { company_id: 0, ...payload };
        const response = await authorizedFetch(`${BASE_URL}/notifications/mark-all-read`, {
          method: 'POST',
          body: JSON.stringify(requestPayload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('No se pudieron marcar todas como leídas', data);
          return 0;
        }
        const updatedCount = Number(data?.updated_count ?? 0);
        setNotifications(prev =>
          prev.map(item => ({
            ...item,
            state: { ...item.state, is_read: true, read_at: item.state.read_at ?? new Date().toISOString() },
          })),
        );
        return Number.isFinite(updatedCount) ? updatedCount : 0;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al marcar todas como leídas, se solicitará uno nuevo.');
          return 0;
        }
        console.error('Error al marcar todas como leídas', error);
        return 0;
      }
    },
    [authorizedFetch, setNotifications],
  );

  const sendNotification = useCallback(
    async (
      payload: ManualNotificationInput,
    ): Promise<{ notificationId: number | null; invalidUserIds: number[] }> => {
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/send`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('No fue posible enviar la notificación manual', data);
          return { notificationId: null, invalidUserIds: Array.from(data?.invalid_user_ids ?? []) };
        }
        const parsed = extractSingleNotification(data);
        if (parsed) {
          mergeNotification(parsed);
        }
        const notificationId = parseNullableNumber(data?.notification_id ?? parsed?.id ?? null);
        const invalidUserIds = Array.isArray(data?.invalid_user_ids)
          ? data.invalid_user_ids.map((item: any) => Number(item)).filter(Number.isFinite)
          : [];
        return { notificationId, invalidUserIds };
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al enviar notificación, se solicitará uno nuevo.');
          return { notificationId: null, invalidUserIds: [] };
        }
        console.error('Error al enviar notificación manual', error);
        return { notificationId: null, invalidUserIds: [] };
      }
    },
    [authorizedFetch, mergeNotification],
  );

  const value = useMemo(
    () => ({
      notifications,
      loading,
      filters,
      loadNotifications,
      markAsRead,
      hideNotification,
      markAllAsRead,
      sendNotification,
    }),
    [filters, hideNotification, loadNotifications, loading, markAllAsRead, markAsRead, notifications, sendNotification],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

