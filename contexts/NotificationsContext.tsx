import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationStatus = 'unread' | 'read' | 'all';

export interface NotificationEntry {
  id: number;
  company_id: number | null;
  type: string;
  title: string;
  body: string;
  source_table: string | null;
  source_id: number | null;
  source_history_id?: number | null;
  payload: any;
  severity: NotificationSeverity;
  created_by_user_id?: number | null;
  created_at: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
  expires_at?: string | null;
  is_read: boolean;
  read_at?: string | null;
  is_hidden: boolean;
  hidden_at?: string | null;
}

interface RefreshOptions {
  companyId?: number | null;
  limit?: number;
  since?: string;
}

interface MarkAllOptions {
  companyId?: number | null;
}

interface NotificationsContextValue {
  notifications: NotificationEntry[];
  loading: boolean;
  unreadCount: number;
  refreshNotifications: (status?: NotificationStatus, options?: RefreshOptions) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<boolean>;
  markAllAsRead: (options?: MarkAllOptions) => Promise<boolean>;
  hideNotification: (notificationId: number) => Promise<boolean>;
}

const defaultContext: NotificationsContextValue = {
  notifications: [],
  loading: false,
  unreadCount: 0,
  refreshNotifications: async () => {},
  markAsRead: async () => false,
  markAllAsRead: async () => false,
  hideNotification: async () => false,
};

export const NotificationsContext = createContext<NotificationsContextValue>(defaultContext);

const parseBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  return Boolean(value);
};

const parseSeverity = (value: any): NotificationSeverity => {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (normalized === 'success' || normalized === 'warning' || normalized === 'error') {
    return normalized;
  }
  return 'info';
};

const parsePayload = (rawPayload: any) => {
  if (rawPayload === null || rawPayload === undefined) return null;
  if (typeof rawPayload === 'string') {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return rawPayload;
    }
  }
  return rawPayload;
};

const normalizeNotification = (raw: any): NotificationEntry => {
  const normalizedId = Number(raw?.id ?? raw?.notification_id ?? 0);
  return {
    id: Number.isFinite(normalizedId) ? normalizedId : Date.now(),
    company_id: raw?.company_id !== undefined && raw?.company_id !== null ? Number(raw.company_id) : null,
    type: raw?.type ?? 'general',
    title: raw?.title ?? 'Notificación',
    body: raw?.body ?? '',
    source_table: raw?.source_table ?? null,
    source_id: raw?.source_id !== undefined && raw?.source_id !== null ? Number(raw.source_id) : null,
    source_history_id:
      raw?.source_history_id !== undefined && raw?.source_history_id !== null
        ? Number(raw.source_history_id)
        : null,
    payload: parsePayload(raw?.payload ?? null),
    severity: parseSeverity(raw?.severity),
    created_by_user_id:
      raw?.created_by_user_id !== undefined && raw?.created_by_user_id !== null
        ? Number(raw.created_by_user_id)
        : null,
    created_at: raw?.created_at ?? new Date().toISOString(),
    scheduled_at: raw?.scheduled_at ?? null,
    sent_at: raw?.sent_at ?? null,
    expires_at: raw?.expires_at ?? null,
    is_read: parseBoolean(raw?.is_read ?? false),
    read_at: raw?.read_at ?? null,
    is_hidden: parseBoolean(raw?.is_hidden ?? false),
    hidden_at: raw?.hidden_at ?? null,
  };
};

const extractNotificationArray = (payload: any): NotificationEntry[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.map(normalizeNotification);
  if (Array.isArray(payload.notifications)) return payload.notifications.map(normalizeNotification);
  if (Array.isArray(payload.data)) return payload.data.map(normalizeNotification);
  if (payload.notification) return [normalizeNotification(payload.notification)];
  return [];
};

const sortNotifications = (items: NotificationEntry[]): NotificationEntry[] => {
  const getTime = (value?: string | null) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  return [...items].sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
};

const mergeNotifications = (
  current: NotificationEntry[],
  incoming: NotificationEntry[],
  { replace }: { replace?: boolean } = {}
): NotificationEntry[] => {
  if (replace) return sortNotifications(incoming);

  const mergedMap = new Map<number, NotificationEntry>();
  current.forEach(item => mergedMap.set(item.id, item));
  incoming.forEach(item => mergedMap.set(item.id, { ...mergedMap.get(item.id), ...item }));

  return sortNotifications(Array.from(mergedMap.values()));
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { token, isLoading: authIsLoading, userId } = useContext(AuthContext);
  const notificationsCacheKey = useMemo(
    () => (userId ? `notifications:${userId}` : 'notifications:guest'),
    [userId]
  );
  const [notifications, setNotifications, notificationsHydrated] = useCachedState<NotificationEntry[]>(
    notificationsCacheKey,
    []
  );
  const [loading, setLoading] = useState(false);

  const authorizedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!token) throw new Error('Missing authentication token');
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
      });
      return response;
    },
    [token]
  );

  const refreshNotifications = useCallback(
    async (status: NotificationStatus = 'unread', options: RefreshOptions = {}) => {
      if (!token) return;
      setLoading(true);
      try {
        const search = new URLSearchParams();
        if (status !== 'all') search.set('status', status);
        if (options.companyId !== undefined && options.companyId !== null) {
          search.set('company_id', String(options.companyId));
        }
        if (options.limit) search.set('limit', String(options.limit));
        if (options.since) search.set('since', options.since);

        const basePath = '/notifications';
        const query = search.toString();
        const response = await authorizedFetch(`${BASE_URL}${basePath}${query ? `?${query}` : ''}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error loading notifications', data);
          return;
        }

        const parsed = sortNotifications(extractNotificationArray(data));
        const shouldReplace = status === 'all';
        setNotifications(prev => mergeNotifications(prev, parsed, { replace: shouldReplace }));
      } catch (error) {
        console.warn('Error loading notifications', error);
      } finally {
        setLoading(false);
      }
    },
    [authorizedFetch, setNotifications, token]
  );

  useEffect(() => {
    if (authIsLoading || !token || !notificationsHydrated) return;
    void refreshNotifications();
  }, [authIsLoading, notificationsHydrated, refreshNotifications, token]);

  const markAsRead = useCallback(
    async (notificationId: number): Promise<boolean> => {
      if (!notificationId) return false;
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error marking notification as read', data);
          return false;
        }

        const updated = extractNotificationArray(data)[0];
        const fallbackReadAt = new Date().toISOString();
        setNotifications(prev =>
          sortNotifications(
            prev.map(item =>
              item.id === notificationId
                ? {
                    ...item,
                    ...(updated ?? {}),
                    is_read: true,
                    read_at: updated?.read_at ?? item.read_at ?? fallbackReadAt,
                  }
                : item
            )
          )
        );
        return true;
      } catch (error) {
        console.warn('Error marking notification as read', error);
        return false;
      }
    },
    [authorizedFetch, setNotifications]
  );

  const markAllAsRead = useCallback(
    async (options: MarkAllOptions = {}): Promise<boolean> => {
      try {
        const body = options.companyId !== undefined && options.companyId !== null
          ? JSON.stringify({ company_id: options.companyId })
          : undefined;
        const response = await authorizedFetch(`${BASE_URL}/notifications/mark-all-read`, {
          method: 'POST',
          body,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error marking all notifications as read', data);
          return false;
        }

        const parsed = extractNotificationArray(data);
        const fallbackReadAt = new Date().toISOString();
        if (parsed.length > 0) {
          const lookup = new Map(parsed.map(item => [item.id, item] as const));
          setNotifications(prev =>
            sortNotifications(
              prev.map(item => {
                const incoming = lookup.get(item.id);
                return {
                  ...item,
                  ...(incoming ?? {}),
                  is_read: incoming?.is_read ?? true,
                  read_at: incoming?.read_at ?? item.read_at ?? fallbackReadAt,
                };
              })
            )
          );
        } else {
          setNotifications(prev =>
            sortNotifications(
              prev.map(item => ({ ...item, is_read: true, read_at: item.read_at ?? fallbackReadAt }))
            )
          );
        }
        return true;
      } catch (error) {
        console.warn('Error marking all notifications as read', error);
        return false;
      }
    },
    [authorizedFetch, setNotifications]
  );

  const hideNotification = useCallback(
    async (notificationId: number): Promise<boolean> => {
      if (!notificationId) return false;
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/${notificationId}/hide`, {
          method: 'PATCH',
          body: JSON.stringify({ is_hidden: true, hidden_at: new Date().toISOString() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error hiding notification', data);
          return false;
        }

        const updated = extractNotificationArray(data)[0];
        const fallbackHiddenAt = new Date().toISOString();
        setNotifications(prev =>
          sortNotifications(
            prev.map(item =>
              item.id === notificationId
                ? {
                    ...item,
                    ...(updated ?? {}),
                    is_hidden: true,
                    hidden_at: updated?.hidden_at ?? item.hidden_at ?? fallbackHiddenAt,
                  }
                : item
            )
          )
        );
        return true;
      } catch (error) {
        console.warn('Error hiding notification', error);
        return false;
      }
    },
    [authorizedFetch, setNotifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.is_read && !item.is_hidden).length,
    [notifications]
  );

  const contextValue = useMemo(
    () => ({
      notifications,
      loading,
      unreadCount,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
      hideNotification,
    }),
    [hideNotification, loading, markAllAsRead, markAsRead, notifications, refreshNotifications, unreadCount]
  );

  return <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>;
};
