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
import { ConfigContext } from '@/contexts/ConfigContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationFilter = 'all' | 'unread' | 'read';

export interface NotificationEntry {
  id: number;
  company_id: number | null;
  type: string | null;
  title: string;
  body: string;
  source_table: string | null;
  source_id: number | null;
  payload: any;
  severity: NotificationSeverity;
  created_at: string;
  is_read: boolean;
  read_at?: string | null;
  is_hidden: boolean;
}

interface NotificationsContextValue {
  notifications: NotificationEntry[];
  loading: boolean;
  unreadCount: number;
  refreshNotifications: (
    filter?: NotificationFilter,
    options?: { applyUnreadVisibilityRule?: boolean }
  ) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<boolean>;
  markAsUnread: (notificationId: number) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
}

const defaultContext: NotificationsContextValue = {
  notifications: [],
  loading: false,
  unreadCount: 0,
  refreshNotifications: async () => {},
  markAsRead: async () => false,
  markAsUnread: async () => false,
  markAllAsRead: async () => false,
};

export const NotificationsContext = createContext<NotificationsContextValue>(defaultContext);

const parseBoolean = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  if (typeof value === 'number') {
    return value !== 0;
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
  if (rawPayload === null || rawPayload === undefined) {
    return null;
  }
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
  const id = Number(raw?.id ?? raw?.notification_id ?? raw?.notif_id ?? 0);
  const createdAt = raw?.created_at ?? raw?.inserted_at ?? new Date().toISOString();
  const isRead = parseBoolean(raw?.is_read ?? raw?.read ?? raw?.leido);
  const isHidden = parseBoolean(raw?.is_hidden ?? raw?.hidden ?? raw?.descartada);

  const resolved: NotificationEntry = {
    id: Number.isFinite(id) ? id : Date.now(),
    company_id:
      raw?.company_id !== undefined && raw?.company_id !== null
        ? Number(raw.company_id)
        : null,
    type: raw?.type ?? raw?.category ?? raw?.kind ?? null,
    title: raw?.title ?? raw?.subject ?? 'Sin título',
    body: raw?.body ?? raw?.message ?? raw?.detail ?? '',
    source_table: raw?.source_table ?? raw?.table ?? raw?.origin_table ?? null,
    source_id:
      raw?.source_id !== undefined && raw?.source_id !== null
        ? Number(raw.source_id)
        : raw?.sourceId !== undefined && raw?.sourceId !== null
          ? Number(raw.sourceId)
          : null,
    payload: parsePayload(raw?.payload ?? raw?.data ?? null),
    severity: parseSeverity(raw?.severity ?? raw?.level ?? raw?.status),
    created_at: createdAt,
    is_read: isRead,
    read_at: raw?.read_at ?? raw?.leido_en ?? (isRead ? raw?.updated_at ?? null : null),
    is_hidden: isHidden,
  };

  return resolved;
};

const extractNotificationArray = (payload: any): NotificationEntry[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map(normalizeNotification);
  }
  if (Array.isArray(payload.notifications)) {
    return payload.notifications.map(normalizeNotification);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.map(normalizeNotification);
  }
  if (payload.notification) {
    return [normalizeNotification(payload.notification)];
  }
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

const mergeNotification = (
  collection: NotificationEntry[],
  updated: NotificationEntry
): NotificationEntry[] => {
  const exists = collection.find(item => item.id === updated.id);
  if (exists) {
    return sortNotifications(
      collection.map(item => (item.id === updated.id ? { ...item, ...updated } : item))
    );
  }
  return sortNotifications([...collection, updated]);
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { token, userId, isLoading: authIsLoading } = useContext(AuthContext);
  const configContext = useContext(ConfigContext);
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
      if (!token) {
        throw new Error('Missing authentication token');
      }
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
    async (
      filter: NotificationFilter = 'all',
      options: { applyUnreadVisibilityRule?: boolean } = { applyUnreadVisibilityRule: false }
    ) => {
      if (!token) {
        return;
      }
      setLoading(true);
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error loading notifications', data);
          return;
        }
        const parsed = extractNotificationArray(data);
        const shouldClearWhenNoUnread =
          options.applyUnreadVisibilityRule &&
          filter === 'unread' &&
          (configContext?.configDetails?.clear_notifications_when_unread_empty ?? false);
        setNotifications(prev => {
          const merged = sortNotifications([
            ...parsed,
            ...prev.filter(item => !parsed.some(fetched => fetched.id === item.id)),
          ]);
          const hasUnread = merged.some(item => !item.is_read && !item.is_hidden);
          if (filter === 'unread' && shouldClearWhenNoUnread && !hasUnread) {
            return [];
          }
          return merged;
        });
      } catch (error) {
        console.warn('Error loading notifications', error);
      } finally {
        setLoading(false);
      }
    },
    [authorizedFetch, configContext?.configDetails?.clear_notifications_when_unread_empty, setNotifications, token]
  );

  useEffect(() => {
    if (!token) return;
    const intervalId = setInterval(() => {
      void refreshNotifications();
    }, 60000);
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshNotifications, token]);

  useEffect(() => {
    if (authIsLoading || !token || !notificationsHydrated) {
      return;
    }

    void refreshNotifications();
  }, [authIsLoading, notificationsHydrated, refreshNotifications, token, userId]);

  const markAsRead = useCallback(
    async (notificationId: number): Promise<boolean> => {
      if (!notificationId) {
        return false;
      }
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
          body: JSON.stringify({ is_read: true }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error marking notification as read', data);
          return false;
        }
        const parsed = extractNotificationArray(data);
        const updated = parsed[0] ?? null;
        if (updated) {
          setNotifications(prev => mergeNotification(prev, updated));
        } else {
          setNotifications(prev =>
            prev.map(item =>
              item.id === notificationId
                ? { ...item, is_read: true, read_at: new Date().toISOString() }
                : item
            )
          );
        }
        return true;
      } catch (error) {
        console.warn('Error marking notification as read', error);
        return false;
      }
    },
    [authorizedFetch, setNotifications]
  );

  const markAsUnread = useCallback(
    async (notificationId: number): Promise<boolean> => {
      if (!notificationId) {
        return false;
      }
      try {
        const response = await authorizedFetch(`${BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
          body: JSON.stringify({ is_read: false }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Error marking notification as unread', data);
          return false;
        }
        const parsed = extractNotificationArray(data);
        const updated = parsed[0] ?? null;
        if (updated) {
          setNotifications(prev => mergeNotification(prev, updated));
        } else {
          setNotifications(prev =>
            prev.map(item => (item.id === notificationId ? { ...item, is_read: false } : item))
          );
        }
        return true;
      } catch (error) {
        console.warn('Error marking notification as unread', error);
        return false;
      }
    },
    [authorizedFetch, setNotifications]
  );

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      const response = await authorizedFetch(`${BASE_URL}/notifications/mark-all-read`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Error marking all notifications as read', data);
        return false;
      }
      const parsed = extractNotificationArray(data);
      if (parsed.length > 0) {
        const updatedMap = new Map(parsed.map(item => [item.id, item] as const));
        setNotifications(prev =>
          sortNotifications(
            prev.map(item => ({ ...item, ...(updatedMap.get(item.id) ?? { is_read: true }) }))
          )
        );
      } else {
        setNotifications(prev => prev.map(item => ({ ...item, is_read: true })));
      }
      return true;
    } catch (error) {
      console.warn('Error marking all notifications as read', error);
      return false;
    }
  }, [authorizedFetch, setNotifications]);

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
      markAsUnread,
      markAllAsRead,
    }),
    [loading, markAllAsRead, markAsRead, markAsUnread, notifications, refreshNotifications, unreadCount]
  );

  return <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>;
};
