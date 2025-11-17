import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

export interface NotificationRecord {
  id: number;
  event_key: string;
  title: string;
  body: string;
  action_reference: string | null;
  metadata: Record<string, unknown> | null;
  metadata_raw: string | null;
  delivery_channel: string | null;
  is_sent: boolean;
  is_sent_push: boolean;
  sent_at: string | null;
  is_read: boolean;
  read_at: string | null;
  user_id: number | null;
  notification_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  delivery_error: string | null;
}

export interface NotificationPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface NotificationQueryOptions {
  page?: number;
  perPage?: number;
  onlyUnread?: boolean;
  eventKey?: string;
  search?: string;
}

export interface DeviceRegistrationPayload {
  device_token: string;
  platform: 'ios' | 'android' | 'web' | 'other' | string;
  is_active?: boolean;
  last_used_at?: string;
}

interface NotificationsContextValue {
  notifications: NotificationRecord[];
  pagination: NotificationPagination | null;
  unreadCount: number;
  lastQuery: NotificationQueryOptions;
  loadingNotifications: boolean;
  loadingUnreadCount: boolean;
  loadNotifications: (options?: NotificationQueryOptions) => Promise<NotificationRecord[]>;
  refreshUnreadCount: () => Promise<number>;
  markNotificationRead: (
    notificationId: number,
    options?: { read?: boolean; timestamp?: string }
  ) => Promise<boolean>;
  markAllNotificationsRead: (options?: { read?: boolean }) => Promise<number>;
  registerDevice: (payload: DeviceRegistrationPayload) => Promise<boolean>;
}

const defaultContext: NotificationsContextValue = {
  notifications: [],
  pagination: null,
  unreadCount: 0,
  lastQuery: { page: 1, perPage: 20, onlyUnread: false },
  loadingNotifications: false,
  loadingUnreadCount: false,
  loadNotifications: async () => [],
  refreshUnreadCount: async () => 0,
  markNotificationRead: async () => false,
  markAllNotificationsRead: async () => 0,
  registerDevice: async () => false,
};

export const NotificationsContext = createContext<NotificationsContextValue>(defaultContext);

const DEFAULT_QUERY: NotificationQueryOptions = {
  page: 1,
  perPage: 20,
  onlyUnread: false,
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  return false;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseMetadata = (value: unknown): { metadata: Record<string, unknown> | null; raw: string | null } => {
  if (value === null || typeof value === 'undefined') {
    return { metadata: null, raw: null };
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return { metadata: { items: value }, raw: JSON.stringify(value) };
    }
    return { metadata: value as Record<string, unknown>, raw: JSON.stringify(value) };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { metadata: null, raw: null };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return {
          metadata: Array.isArray(parsed) ? { items: parsed } : (parsed as Record<string, unknown>),
          raw: trimmed,
        };
      }
    } catch {
      // keep going
    }
    return { metadata: null, raw: trimmed };
  }

  return { metadata: null, raw: String(value) };
};

const coerceDate = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
};

const getSortValue = (notification: NotificationRecord): number => {
  const candidates = [notification.created_at, notification.sent_at, notification.read_at, notification.updated_at];
  for (const candidate of candidates) {
    if (candidate) {
      const time = Date.parse(candidate);
      if (!Number.isNaN(time)) {
        return time;
      }
    }
  }
  return notification.id;
};

const sortNotifications = (items: NotificationRecord[]): NotificationRecord[] =>
  [...items].sort((a, b) => getSortValue(b) - getSortValue(a));

const normalizeNotification = (raw: any): NotificationRecord => {
  const id = parseNumber(raw?.id ?? raw?.notification_id ?? raw?.notificationId) ?? 0;
  const userId = parseNumber(raw?.user_id ?? raw?.usuario_id ?? raw?.userId);
  const notificationId =
    parseNumber(raw?.notification_id ?? raw?.notificationId ?? raw?.id) ??
    parseNumber(raw?.user_notification_id ?? raw?.userNotificationId ?? raw?.user_notification);
  const { metadata, raw: metadataRaw } = parseMetadata(raw?.metadata ?? raw?.meta ?? raw?.payload);

  return {
    id,
    event_key: raw?.event_key ?? raw?.eventKey ?? 'generic.event',
    title: raw?.title ?? raw?.subject ?? raw?.event_title ?? '',
    body: raw?.body ?? raw?.message ?? raw?.content ?? '',
    action_reference: raw?.action_reference ?? raw?.action ?? raw?.action_url ?? null,
    metadata,
    metadata_raw: metadataRaw,
    delivery_channel: raw?.delivery_channel ?? raw?.channel ?? null,
    is_sent: parseBoolean(raw?.is_sent ?? raw?.sent ?? raw?.was_sent),
    is_sent_push: parseBoolean(raw?.is_sent_push ?? raw?.push_sent ?? raw?.push_status),
    sent_at: coerceDate(raw?.sent_at ?? raw?.delivery_at ?? raw?.delivered_at),
    is_read: parseBoolean(raw?.is_read ?? raw?.read ?? raw?.read_flag),
    read_at: coerceDate(raw?.read_at ?? raw?.readAt ?? raw?.read_timestamp),
    user_id: userId,
    notification_id: notificationId,
    created_at: coerceDate(raw?.created_at ?? raw?.createdAt),
    updated_at: coerceDate(raw?.updated_at ?? raw?.updatedAt),
    delivery_error: raw?.delivery_error ?? raw?.error ?? null,
  };
};

const extractNotificationArray = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.notifications)) {
    return payload.notifications;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
};

const normalizePagination = (payload: any): NotificationPagination | null => {
  if (!payload) {
    return null;
  }
  const current = parseNumber(payload.current_page ?? payload.currentPage ?? payload.page) ?? 1;
  const perPage = parseNumber(payload.per_page ?? payload.perPage ?? payload.limit ?? payload.pageSize) ?? 20;
  const total = parseNumber(payload.total ?? payload.total_items ?? payload.totalItems) ?? 0;
  const lastPage = parseNumber(payload.last_page ?? payload.total_pages ?? payload.totalPages) ??
    Math.max(1, Math.ceil(total / perPage));
  return {
    current_page: current,
    per_page: perPage,
    total,
    last_page: lastPage,
  };
};

const buildQueryParams = (options: NotificationQueryOptions): string => {
  const params = new URLSearchParams();
  if (typeof options.page === 'number') {
    params.set('page', options.page.toString());
  }
  if (typeof options.perPage === 'number') {
    params.set('per_page', options.perPage.toString());
  }
  if (typeof options.onlyUnread === 'boolean') {
    params.set('only_unread', options.onlyUnread ? 'true' : 'false');
  }
  if (options.eventKey) {
    params.set('event_key', options.eventKey);
  }
  if (options.search) {
    params.set('search', options.search);
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { token, checkConnection } = useContext(AuthContext);
  const [notifications, setNotifications] = useCachedState<NotificationRecord[]>(
    'notifications',
    []
  );
  const [pagination, setPagination] = useState<NotificationPagination | null>(null);
  const [unreadCount, setUnreadCount] = useCachedState<number>('notifications_unread_count', 0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingUnreadCount, setLoadingUnreadCount] = useState(false);
  const [queryOptions, setQueryOptions] = useState<NotificationQueryOptions>(DEFAULT_QUERY);
  const queryRef = useRef<NotificationQueryOptions>(queryOptions);

  useEffect(() => {
    queryRef.current = queryOptions;
  }, [queryOptions]);

  useEffect(() => {
    setNotifications(prev => sortNotifications(prev));
  }, [setNotifications]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setPagination(null);
      setUnreadCount(0);
    }
  }, [token, setNotifications, setUnreadCount]);

  const loadNotifications = useCallback(
    async (options?: NotificationQueryOptions): Promise<NotificationRecord[]> => {
      if (!token) {
        return [];
      }
      const merged = {
        ...DEFAULT_QUERY,
        ...queryRef.current,
        ...(options ?? {}),
      };
      setQueryOptions(merged);

      const query = buildQueryParams(merged);
      setLoadingNotifications(true);
      try {
        const response = await fetch(`${BASE_URL}/notifications${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        const payload = await response.json();
        const parsed = extractNotificationArray(payload).map(normalizeNotification);
        setNotifications(sortNotifications(parsed));
        const paginationPayload = payload?.pagination ?? payload?.meta ?? payload;
        setPagination(normalizePagination(paginationPayload));
        return parsed;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('El token expiró al cargar notificaciones; se solicitará nuevamente.');
          return [];
        }
        console.error('Error cargando notificaciones:', error);
        return [];
      } finally {
        setLoadingNotifications(false);
      }
    },
    [token, checkConnection, setNotifications]
  );

  const refreshUnreadCount = useCallback(async (): Promise<number> => {
    if (!token) {
      setUnreadCount(0);
      return 0;
    }
    setLoadingUnreadCount(true);
    try {
      const response = await fetch(`${BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await ensureAuthResponse(response, { onUnauthorized: checkConnection });
      const payload = await response.json();
      const unread = parseNumber(payload?.unread ?? payload?.count ?? payload?.total) ?? 0;
      setUnreadCount(unread);
      return unread;
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('El token expiró al obtener el contador de notificaciones.');
        setUnreadCount(0);
        return 0;
      }
      console.error('Error obteniendo el contador de no leídas:', error);
      return unreadCount;
    } finally {
      setLoadingUnreadCount(false);
    }
  }, [token, checkConnection, setUnreadCount, unreadCount]);

  const markNotificationRead = useCallback(
    async (
      notificationId: number,
      options?: { read?: boolean; timestamp?: string }
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }
      const body: Record<string, unknown> = {};
      if (typeof options?.read === 'boolean') {
        body.read = options.read;
      }
      if (options?.timestamp) {
        body.timestamp = options.timestamp;
      }

      try {
        const response = await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        });
        await ensureAuthResponse(response, { onUnauthorized: checkConnection, silent: false });
        let updated: NotificationRecord | null = null;
        try {
          const payload = await response.json();
          const item = extractNotificationArray(payload)[0] ?? payload?.notification ?? payload;
          if (item) {
            updated = normalizeNotification(item);
          }
        } catch {
          // ignore body parsing errors (204 No Content)
        }

        const readFlag = options?.read === false ? false : true;
        const timestamp = options?.timestamp ?? new Date().toISOString();

        setNotifications(prev => {
          const next = prev.map(item => {
            if (item.id !== notificationId) {
              return item;
            }
            if (updated) {
              return updated;
            }
            return {
              ...item,
              is_read: readFlag,
              read_at: readFlag ? timestamp : null,
            };
          });
          return sortNotifications(next);
        });

        setUnreadCount(prev => {
          if (!readFlag) {
            return prev + 1;
          }
          return prev > 0 ? prev - 1 : 0;
        });

        return true;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('El token expiró al marcar la notificación como leída.');
          return false;
        }
        console.error('Error marcando notificación como leída:', error);
        return false;
      }
    },
    [token, checkConnection, setNotifications, setUnreadCount]
  );

  const markAllNotificationsRead = useCallback(
    async (options?: { read?: boolean }): Promise<number> => {
      if (!token) {
        return 0;
      }
      const payload: Record<string, unknown> = {};
      if (typeof options?.read === 'boolean') {
        payload.read = options.read;
      }
      const body = Object.keys(payload).length > 0 ? JSON.stringify(payload) : JSON.stringify({ read: true });
      try {
        const response = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body,
        });
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        let affected = 0;
        try {
          const result = await response.json();
          affected = parseNumber(result?.affected ?? result?.count ?? result?.updated ?? result?.success) ?? 0;
        } catch {
          // ignore empty body
        }
        const readFlag = options?.read === false ? false : true;
        const timestamp = new Date().toISOString();
        setNotifications(prev =>
          sortNotifications(
            prev.map(item => ({
              ...item,
              is_read: readFlag ? true : false,
              read_at: readFlag ? item.read_at ?? timestamp : null,
            }))
          )
        );
        if (readFlag) {
          setUnreadCount(0);
        } else {
          void refreshUnreadCount();
        }
        return affected;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('El token expiró al marcar todas las notificaciones.');
          return 0;
        }
        console.error('Error marcando todas las notificaciones:', error);
        return 0;
      }
    },
    [token, checkConnection, setNotifications, refreshUnreadCount]
  );

  const registerDevice = useCallback(
    async (payload: DeviceRegistrationPayload): Promise<boolean> => {
      if (!token) {
        return false;
      }
      const body: Record<string, unknown> = {
        device_token: payload.device_token,
        platform: payload.platform,
        is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
      };
      if (payload.last_used_at) {
        body.last_used_at = payload.last_used_at;
      }
      try {
        const response = await fetch(`${BASE_URL}/user-devices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        return response.ok;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('El token expiró al registrar el dispositivo para push.');
          return false;
        }
        console.error('Error registrando el dispositivo:', error);
        return false;
      }
    },
    [token, checkConnection]
  );

  const value = useMemo(
    () => ({
      notifications,
      pagination,
      unreadCount,
      lastQuery: queryOptions,
      loadingNotifications,
      loadingUnreadCount,
      loadNotifications,
      refreshUnreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      registerDevice,
    }),
    [
      notifications,
      pagination,
      unreadCount,
      queryOptions,
      loadingNotifications,
      loadingUnreadCount,
      loadNotifications,
      refreshUnreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      registerDevice,
    ]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
