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
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { useCachedState } from '@/hooks/useCachedState';
import {
  MEMBERSHIP_ROLE_SUGGESTIONS,
  MEMBERSHIP_STATUS_OPTIONS,
  MembershipLifecycleStatus,
  normalizeMembershipStatus,
} from '@/constants/companyMemberships';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';

export interface MembershipAuditFlags {
  [key: string]: boolean | undefined;
}

export interface CompanyMembership {
  id: number;
  company_id: number;
  company_name: string;
  user_id: number;
  user_name: string;
  user_email?: string | null;
  role?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message?: string | null;
  reason?: string | null;
  responded_at?: string | null;
  responded_by_id?: number | null;
  responded_by_name?: string | null;
  audit_flags?: MembershipAuditFlags | null;
  normalized_status?: MembershipLifecycleStatus | null;
  request_template?: string | null;
  request_template_label?: string | null;
  response_template?: string | null;
  response_template_label?: string | null;
  response_message?: string | null;
  response_channel?: string | null;
  response_summary?: string | null;
}

export interface CompanyMembershipPayload {
  company_id: number;
  user_id: number;
  role: string | null;
  status: string | null;
  notes: string | null;
  message?: string | null;
  reason?: string | null;
  responded_at?: string | null;
  audit_flags?: MembershipAuditFlags | null;
  request_template?: string | null;
  request_template_label?: string | null;
  response_template?: string | null;
  response_template_label?: string | null;
  response_message?: string | null;
  response_channel?: string | null;
  response_summary?: string | null;
}

interface MembershipHttpError extends Error {
  status?: number;
  details?: unknown;
}

export interface MembershipRequestOptions {
  role?: string | null;
  status?: string | null;
  notes?: string | null;
  message?: string | null;
  request_template?: string | null;
  request_template_label?: string | null;
  position_title?: string | null;
  department?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  employment_type?: string | null;
  visibility?: string | null;
  profile_excerpt?: string | null;
}

export type MembershipDecision = 'approve' | 'reject';

export interface MembershipStatusUpdateOptions {
  role?: string | null;
  notes?: string | null;
  reason?: string | null;
  message?: string | null;
  decision?: MembershipDecision;
  responded_at?: string | null;
  audit_flags?: MembershipAuditFlags | null;
  response_template?: string | null;
  response_template_label?: string | null;
  response_message?: string | null;
  response_channel?: string | null;
  response_summary?: string | null;
}

export type MembershipNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface MembershipNotification {
  id: string;
  severity: MembershipNotificationSeverity;
  message: string;
  description?: string | null;
  createdAt: string;
}

interface CompanyMembershipsContextValue {
  memberships: CompanyMembership[];
  hydrated: boolean;
  loading: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  isStale: boolean;
  notifications: MembershipNotification[];
  statusCatalog: typeof MEMBERSHIP_STATUS_OPTIONS;
  roleCatalog: typeof MEMBERSHIP_ROLE_SUGGESTIONS;
  normalizeStatus: (value?: string | null) => MembershipLifecycleStatus | null;
  loadCompanyMemberships: (companyId?: number | string | null) => Promise<CompanyMembership[]>;
  addCompanyMembership: (payload: CompanyMembershipPayload) => Promise<CompanyMembership | null>;
  updateCompanyMembership: (id: number, payload: CompanyMembershipPayload) => Promise<boolean>;
  deleteCompanyMembership: (id: number) => Promise<boolean>;
  requestMembershipAccess: (
    companyId: number,
    options?: MembershipRequestOptions
  ) => Promise<CompanyMembership | null>;
  updateMembershipStatus: (
    id: number,
    status: string,
    options?: MembershipStatusUpdateOptions
  ) => Promise<CompanyMembership | null>;
  enqueueNotification: (
    message: string,
    severity?: MembershipNotificationSeverity,
    description?: string | null
  ) => string | null;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  clearSyncError: () => void;
}

const defaultContextValue: CompanyMembershipsContextValue = {
  memberships: [],
  hydrated: false,
  loading: false,
  lastSyncedAt: null,
  syncError: null,
  isStale: false,
  notifications: [],
  statusCatalog: MEMBERSHIP_STATUS_OPTIONS,
  roleCatalog: MEMBERSHIP_ROLE_SUGGESTIONS,
  normalizeStatus: normalizeMembershipStatus,
  loadCompanyMemberships: async () => [],
  addCompanyMembership: async () => null,
  updateCompanyMembership: async () => false,
  deleteCompanyMembership: async () => false,
  requestMembershipAccess: async () => null,
  updateMembershipStatus: async () => null,
  enqueueNotification: () => null,
  dismissNotification: () => undefined,
  clearNotifications: () => undefined,
  clearSyncError: () => undefined,
};

export const CompanyMembershipsContext =
  createContext<CompanyMembershipsContextValue>(defaultContextValue);

const coerceToNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
};

const unwrapMembershipNode = (value: any): any => {
  let current = value;
  const visited = new Set<any>();

  while (current && typeof current === 'object' && !Array.isArray(current)) {
    if (visited.has(current)) {
      return current;
    }
    visited.add(current);

    if ('id' in current && ('company_id' in current || 'companyId' in current || 'company' in current)) {
      return current;
    }

    if (current.membership && typeof current.membership === 'object') {
      current = current.membership;
      continue;
    }

    if (
      current.data &&
      typeof current.data === 'object' &&
      !Array.isArray(current.data) &&
      Object.keys(current.data).length
    ) {
      current = current.data;
      continue;
    }

    if (current.items && typeof current.items === 'object' && !Array.isArray(current.items)) {
      current = current.items;
      continue;
    }

    break;
  }

  return current;
};

const parseAuditFlags = (value: any): MembershipAuditFlags | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const flags: MembershipAuditFlags = {};
  Object.entries(value).forEach(([key, raw]) => {
    let normalized: boolean | undefined;
    if (typeof raw === 'boolean') {
      normalized = raw;
    } else if (typeof raw === 'number') {
      normalized = raw !== 0;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) {
        normalized = undefined;
      } else if (['1', 'true', 'yes', 'y', 'on', 'si', 'sí', 'active', 'approved'].includes(trimmed)) {
        normalized = true;
      } else if (['0', 'false', 'no', 'off', 'inactive', 'rejected'].includes(trimmed)) {
        normalized = false;
      }
    }

    if (typeof normalized === 'boolean') {
      flags[key] = normalized;
    }
  });

  return Object.keys(flags).length ? flags : null;
};

const parseMembership = (rawValue: any): CompanyMembership | null => {
  const raw = unwrapMembershipNode(rawValue);
  if (!raw) {
    return null;
  }

  const id = coerceToNumber(raw.id);
  const companyId = coerceToNumber(raw.company_id ?? raw.companyId ?? raw.company?.id);
  const userId = coerceToNumber(raw.user_id ?? raw.userId ?? raw.user?.id);

  if (id === null || companyId === null || userId === null) {
    return null;
  }

  const getString = (value: any): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    return null;
  };

  const fallbackCompanyName =
    getString(raw.company_name) ??
    getString(raw.company?.name) ??
    getString(raw.company?.legal_name) ??
    `Empresa #${companyId}`;

  const fallbackUserName =
    getString(raw.user_name) ??
    getString(raw.user?.username) ??
    getString(raw.user?.name) ??
    `Usuario #${userId}`;

  const respondedBy = raw.responded_by ?? raw.response_user ?? raw.responder ?? null;
  const respondedByIdCandidate =
    respondedBy?.id ?? respondedBy?.user_id ?? raw.responded_by_id ?? raw.responder_id ?? null;
  const respondedByNameCandidate =
    respondedBy?.username ??
    respondedBy?.name ??
    respondedBy?.full_name ??
    raw.responded_by_name ??
    raw.responder_name ??
    null;

  const status = getString(raw.status) ?? getString(raw.membership_status);

  return {
    id,
    company_id: companyId,
    company_name: fallbackCompanyName,
    user_id: userId,
    user_name: fallbackUserName,
    user_email:
      getString(raw.user_email) ??
      getString(raw.user?.email) ??
      null,
    role: getString(raw.role) ?? getString(raw.membership_role),
    status,
    notes: getString(raw.notes) ?? getString(raw.membership_notes),
    created_at: getString(raw.created_at),
    updated_at: getString(raw.updated_at),
    message: getString(raw.message) ?? getString(raw.request_message),
    reason: getString(raw.reason) ?? getString(raw.rejection_reason),
    responded_at:
      getString(raw.responded_at) ?? getString(raw.response_at) ?? getString(raw.answered_at) ?? null,
    responded_by_id: coerceToNumber(respondedByIdCandidate),
    responded_by_name: getString(respondedByNameCandidate),
    audit_flags: parseAuditFlags(raw.audit_flags ?? raw.flags ?? raw.audit ?? raw.status_flags),
    normalized_status: normalizeMembershipStatus(status),
    request_template: getString(raw.request_template) ?? getString(raw.requestTemplate),
    request_template_label:
      getString(raw.request_template_label) ?? getString(raw.requestTemplateLabel),
    response_template: getString(raw.response_template) ?? getString(raw.responseTemplate),
    response_template_label:
      getString(raw.response_template_label) ?? getString(raw.responseTemplateLabel),
    response_message: getString(raw.response_message) ?? getString(raw.responseMessage),
    response_channel: getString(raw.response_channel) ?? getString(raw.notification_channel),
    response_summary: getString(raw.response_summary) ?? getString(raw.notification_summary),
  };
};

const normalizeCollection = (value: any): CompanyMembership[] => {
  if (!value) {
    return [];
  }

  const resolveArray = (): any[] => {
    if (Array.isArray(value)) {
      return value;
    }
    if (Array.isArray(value.memberships)) {
      return value.memberships;
    }
    if (Array.isArray(value.data)) {
      return value.data;
    }
    if (Array.isArray(value.data?.items)) {
      return value.data.items;
    }
    if (Array.isArray(value.data?.memberships)) {
      return value.data.memberships;
    }
    if (Array.isArray(value.items)) {
      return value.items;
    }
    if (Array.isArray(value.items?.data)) {
      return value.items.data;
    }
    return [];
  };

  return resolveArray()
    .map(parseMembership)
    .filter((membership): membership is CompanyMembership => Boolean(membership));
};

const serializePayload = (payload: CompanyMembershipPayload) => {
  const body: Record<string, unknown> = {
    company_id: payload.company_id,
    user_id: payload.user_id,
    role: payload.role,
    status: payload.status,
    notes: payload.notes,
  };

  if ('message' in payload) {
    body.message = payload.message ?? null;
  }
  if ('reason' in payload) {
    body.reason = payload.reason ?? null;
  }
  if ('responded_at' in payload) {
    body.responded_at = payload.responded_at ?? null;
  }
  if ('audit_flags' in payload) {
    body.audit_flags = payload.audit_flags ?? null;
  }
  if ('request_template' in payload) {
    body.request_template = payload.request_template ?? null;
  }
  if ('request_template_label' in payload) {
    body.request_template_label = payload.request_template_label ?? null;
  }
  if ('response_template' in payload) {
    body.response_template = payload.response_template ?? null;
  }
  if ('response_template_label' in payload) {
    body.response_template_label = payload.response_template_label ?? null;
  }
  if ('response_message' in payload) {
    body.response_message = payload.response_message ?? null;
  }
  if ('response_channel' in payload) {
    body.response_channel = payload.response_channel ?? null;
  }
  if ('response_summary' in payload) {
    body.response_summary = payload.response_summary ?? null;
  }

  return body;
};

const MEMBERSHIP_ENDPOINT_VARIANTS = ['/company_memberships', '/company-memberships'] as const;
const MEMBERSHIP_STREAM_SUFFIX = '/stream';
const REFRESH_INTERVAL_MINUTES = 5;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_MINUTES * 60 * 1000;
const STREAM_HANDSHAKE_TIMEOUT_MS = 5000;
const MAX_NOTIFICATION_QUEUE = 6;
const MEMBERSHIP_REQUEST_TIMEOUT_MS = 15000;
const MEMBERSHIP_RESPONSE_PREVIEW_LIMIT = 600;

type EventSourceLike = {
  close: () => void;
  onmessage: null | ((event: { data: string }) => void);
  onerror: null | ((event: any) => void);
};

type EventSourceConstructorLike = new (url: string) => EventSourceLike;

type WebSocketLike = {
  close: () => void;
  onmessage: null | ((event: { data: string }) => void);
  onerror: null | ((event: any) => void);
};

type WebSocketConstructorLike = new (url: string) => WebSocketLike;

const describeUnknownError = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length ? trimmed : null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch (serializationError) {
    console.error('Unable to serialize error payload:', serializationError);
  }

  return null;
};

const formatMembershipLogPrefix = (
  label: string,
  method: string,
  url: string,
  durationMs?: number
): string => {
  const base = `[Membresías][${label}] ${method.toUpperCase()} ${url}`;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    return `${base} (${durationMs} ms)`;
  }
  return base;
};

const normalizeResponsePreview = (text: string | null): string | null => {
  if (!text) {
    return null;
  }
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized.length) {
    return null;
  }
  if (normalized.length > MEMBERSHIP_RESPONSE_PREVIEW_LIMIT) {
    return `${normalized.slice(0, MEMBERSHIP_RESPONSE_PREVIEW_LIMIT)}… (+${
      normalized.length - MEMBERSHIP_RESPONSE_PREVIEW_LIMIT
    } caracteres)`;
  }
  return normalized;
};

const readResponsePreview = async (response: Response): Promise<string> => {
  try {
    const preview = normalizeResponsePreview(await response.clone().text());
    return preview ?? '<<sin cuerpo>>';
  } catch (error) {
    const details = describeUnknownError(error);
    return `<<sin acceso al cuerpo${details ? `: ${details}` : ''}>>`;
  }
};

const linkAbortSignals = (
  controller: AbortController,
  externalSignal?: AbortSignal | null
): (() => void) => {
  if (!externalSignal) {
    return () => {};
  }

  if (externalSignal.aborted) {
    controller.abort((externalSignal as any).reason);
    return () => {};
  }

  const abortHandler = () => {
    try {
      controller.abort((externalSignal as any).reason);
    } catch (error) {
      console.error('No se pudo propagar el motivo de cancelación:', error);
      controller.abort();
    }
  };

  externalSignal.addEventListener('abort', abortHandler);
  return () => {
    externalSignal.removeEventListener('abort', abortHandler);
  };
};

const logMembershipResponse = async (
  response: Response,
  method: string,
  url: string,
  durationMs: number
) => {
  const statusLine = `${response.status} ${response.statusText}`.trim();
  const prefix = formatMembershipLogPrefix(response.ok ? 'OK' : 'ERROR', method, url, durationMs);
  const preview = await readResponsePreview(response);
  const logger = response.ok ? console.log : console.error;
  logger(`${prefix} ${statusLine}`.trim());
  console.log(`[Membresías][Respuesta] ${preview}`);
};

const fetchMembershipWithLogging = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const method = String(init?.method ?? 'GET').toUpperCase();
  const startedAt = Date.now();
  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, MEMBERSHIP_REQUEST_TIMEOUT_MS);
  const unlinkSignals = linkAbortSignals(controller, init?.signal ?? undefined);
  console.log(formatMembershipLogPrefix('Solicitud', method, url));

  try {
    const response = await fetch(url, {
      ...(init ?? {}),
      method,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    await logMembershipResponse(response, method, url, durationMs);
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (timeoutTriggered && error instanceof Error && error.name === 'AbortError') {
      console.error(formatMembershipLogPrefix('TIEMPO EXCEDIDO', method, url, durationMs));
    } else {
      console.error(formatMembershipLogPrefix('ERROR', method, url, durationMs), error);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    unlinkSignals();
  }
};

const toWebSocketUrl = (url: string): string => {
  if (url.startsWith('https://')) {
    return `wss://${url.slice('https://'.length)}`;
  }
  if (url.startsWith('http://')) {
    return `ws://${url.slice('http://'.length)}`;
  }
  return url;
};

const buildMembershipStreamingUrl = (
  endpoint: string | null,
  token?: string | null
): string | null => {
  if (!endpoint) {
    return null;
  }
  const basePath = `${BASE_URL}${endpoint}${MEMBERSHIP_STREAM_SUFFIX}`;
  if (!token) {
    return basePath;
  }
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}token=${encodeURIComponent(token)}`;
};

const parseJsonSafely = (text: string): any => {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Unable to parse memberships payload:', error);
    return null;
  }
};

const extractMembershipFromPayload = (payload: any): CompanyMembership | null => {
  if (!payload) {
    return null;
  }
  return parseMembership(payload.membership ?? payload.data ?? payload);
};

const extractErrorMessage = (payload: any): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof payload.message === 'string') {
    const trimmed = payload.message.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  if (typeof payload.error === 'string') {
    const trimmed = payload.error.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  if (typeof payload.detail === 'string') {
    const trimmed = payload.detail.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  if (Array.isArray(payload.errors)) {
    const messages = payload.errors
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    if (messages.length) {
      return messages.join(' ');
    }
  }

  if (payload.errors && typeof payload.errors === 'object') {
    const messages: string[] = [];
    Object.values(payload.errors).forEach(value => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string' && item.trim().length) {
            messages.push(item.trim());
          }
        });
      } else if (typeof value === 'string' && value.trim().length) {
        messages.push(value.trim());
      }
    });
    if (messages.length) {
      return messages.join(' ');
    }
  }

  return null;
};

const buildHttpError = (
  status: number,
  fallbackMessage: string,
  payload: any
): MembershipHttpError => {
  const errorMessage = extractErrorMessage(payload) ?? fallbackMessage;
  const error = new Error(errorMessage) as MembershipHttpError;
  error.status = status;
  error.details = payload;
  return error;
};

const buildCompanyMembershipUrl = (
  companyId: number,
  membershipId?: number | null,
  suffix = ''
): string => {
  const normalizedSuffix = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';
  const membershipSegment = membershipId ? `/${membershipId}` : '';
  return `${BASE_URL}/companies/${companyId}/memberships${membershipSegment}${normalizedSuffix}`;
};

const fetchMembershipResource = async (
  suffix = '',
  init?: RequestInit | (() => RequestInit),
  onEndpointResolved?: (endpoint: string) => void
): Promise<Response> => {
  const normalizedSuffix = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';
  const buildOptions = (): RequestInit | undefined => {
    if (!init) {
      return undefined;
    }
    if (typeof init === 'function') {
      return (init as () => RequestInit)();
    }
    return { ...init };
  };

  for (let index = 0; index < MEMBERSHIP_ENDPOINT_VARIANTS.length; index += 1) {
    const basePath = MEMBERSHIP_ENDPOINT_VARIANTS[index];
    const response = await fetchMembershipWithLogging(
      `${BASE_URL}${basePath}${normalizedSuffix}`,
      buildOptions()
    );
    const isLastAttempt = index === MEMBERSHIP_ENDPOINT_VARIANTS.length - 1;

    if (response.ok) {
      onEndpointResolved?.(basePath);
      return response;
    }

    if (response.status === 404 && !isLastAttempt) {
      continue;
    }

    return response;
  }

  throw new Error('Unable to resolve company memberships endpoint');
};

export const CompanyMembershipsProvider = ({ children }: { children: ReactNode }) => {
  const { token, userId } = useContext(AuthContext);
  const { companies } = useContext(CompaniesContext);
  const { normalizedUserId, isSuperAdministrator } = useSuperAdministrator();
  const headers = useMemo(() => {
    if (!token) {
      return null;
    }
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    } satisfies Record<string, string>;
  }, [token]);
  const [memberships, setMemberships, hydrated] = useCachedState<CompanyMembership[]>(
    'company_memberships',
    []
  );
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [notifications, setNotifications] = useState<MembershipNotification[]>([]);
  const [supportsStreaming, setSupportsStreaming] = useState(false);
  const [membershipEndpoint, setMembershipEndpoint] = useState<string | null>(null);
  const membershipsRef = useRef<CompanyMembership[]>(memberships);
  const streamingWarningIssuedRef = useRef(false);
  const missingAdminWarningIssuedRef = useRef(false);

  const administeredCompanyIds = useMemo(() => {
    const collected = new Set<number>();
    companies.forEach(company => {
      const numericCompanyId = coerceToNumber(company.id);
      if (numericCompanyId === null) {
        return;
      }
      if (isSuperAdministrator) {
        collected.add(numericCompanyId);
        return;
      }
      if (!normalizedUserId) {
        return;
      }
      if (!Array.isArray(company.administrator_ids) || !company.administrator_ids.length) {
        return;
      }
      const isAdministered = company.administrator_ids.some(
        adminId => String(adminId ?? '').trim() === normalizedUserId
      );
      if (isAdministered) {
        collected.add(numericCompanyId);
      }
    });
    return Array.from(collected);
  }, [companies, isSuperAdministrator, normalizedUserId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setMemberships(prev => prev.map(item => parseMembership(item) ?? item));
  }, [hydrated, setMemberships]);

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  useEffect(() => {
    if (!headers) {
      setIsStale(false);
      setSyncError(null);
    }
  }, [headers]);

  const enqueueNotification = useCallback(
    (message: string, severity: MembershipNotificationSeverity = 'info', description?: string | null) => {
      if (!message) {
        return null;
      }

      const notification: MembershipNotification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        severity,
        message,
        description: description ?? null,
        createdAt: new Date().toISOString(),
      };

      setNotifications(prev => {
        const next = [notification, ...prev];
        return next.slice(0, MAX_NOTIFICATION_QUEUE);
      });

      return notification.id;
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  const reportOperationalError = useCallback(
    (message: string, error?: unknown) => {
      const details = describeUnknownError(error);
      enqueueNotification(message, 'error', details);
      if (error instanceof Error) {
        console.error(message, error);
      } else if (details) {
        console.error(message, details);
      } else if (error !== undefined) {
        console.error(message, error);
      }
    },
    [enqueueNotification]
  );

  const handleSyncSuccess = useCallback(
    (options?: { message?: string; severity?: MembershipNotificationSeverity }) => {
      setLastSyncedAt(new Date().toISOString());
      setSyncError(null);
      setIsStale(false);
      if (options?.message) {
        enqueueNotification(options.message, options.severity ?? 'success');
      }
    },
    [enqueueNotification]
  );

  const handleSyncFailure = useCallback(
    (message: string, error?: unknown) => {
      setIsStale(true);
      setSyncError(message);
      reportOperationalError(message, error);
    },
    [reportOperationalError]
  );

  const postCompanyMembershipAction = useCallback(
    async (
      companyId: number,
      membershipId: number | null,
      suffix: string,
      body: Record<string, unknown>
    ): Promise<Response> => {
      if (!headers) {
        const error = new Error('Se requiere autenticación para operar sobre membresías');
        (error as MembershipHttpError).status = 401;
        throw error;
      }

      const url = buildCompanyMembershipUrl(companyId, membershipId ?? undefined, suffix);
      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    },
    [headers]
  );

  const mergeMembershipIntoState = useCallback(
    (incoming: CompanyMembership) => {
      setMemberships(prev => {
        const index = prev.findIndex(item => item.id === incoming.id);
        if (index === -1) {
          return [incoming, ...prev];
        }

        const clone = [...prev];
        clone[index] = { ...clone[index], ...incoming };
        return clone;
      });
      handleSyncSuccess();
    },
    [handleSyncSuccess, setMemberships]
  );

  const fetchMembershipResourceWithEndpoint = useCallback(
    (suffix = '', init?: RequestInit | (() => RequestInit)) =>
      fetchMembershipResource(suffix, init, setMembershipEndpoint),
    [setMembershipEndpoint]
  );

  const loadCompanyMembershipsForCompany = useCallback(
    async (
      targetCompanyId: number,
      options?: { silent?: boolean }
    ): Promise<CompanyMembership[]> => {
      const numericCompanyId = coerceToNumber(targetCompanyId);
      if (numericCompanyId === null) {
        return [];
      }

      if (!headers) {
        return membershipsRef.current.filter(item => item.company_id === numericCompanyId);
      }

      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
      }
      try {
        const response = await fetch(buildCompanyMembershipUrl(numericCompanyId), { headers });

        if (response.status === 404) {
          setMemberships(prev => prev.filter(item => item.company_id !== numericCompanyId));
          if (!silent) {
            handleSyncSuccess();
          }
          return [];
        }

        if (!response.ok) {
          if (!silent) {
            handleSyncFailure(
              'No pudimos cargar las solicitudes de membresía de la empresa.',
              `${response.status} ${response.statusText}`
            );
            return membershipsRef.current.filter(item => item.company_id === numericCompanyId);
          }
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        if (!text) {
          setMemberships(prev => prev.filter(item => item.company_id !== numericCompanyId));
          if (!silent) {
            handleSyncSuccess();
          }
          return [];
        }

        try {
          const json = JSON.parse(text);
          const normalized = normalizeCollection(json);
          setMemberships(prev => {
            const filtered = prev.filter(item => item.company_id !== numericCompanyId);
            return [...normalized, ...filtered];
          });
          if (!silent) {
            handleSyncSuccess();
          }
          return normalized;
        } catch (error) {
          if (!silent) {
            handleSyncFailure('No pudimos interpretar las membresías de la empresa.', error);
            return membershipsRef.current.filter(item => item.company_id === numericCompanyId);
          }
          throw error;
        }
      } catch (error) {
        if (!silent) {
          handleSyncFailure('No pudimos sincronizar las membresías de la empresa.', error);
          return membershipsRef.current.filter(item => item.company_id === numericCompanyId);
        }
        throw error;
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [handleSyncFailure, handleSyncSuccess, headers, setMemberships]
  );

  const loadCompanyMembershipsFromCompanies = useCallback(
    async (): Promise<CompanyMembership[]> => {
      if (!headers) {
        return membershipsRef.current;
      }

      const companyIds = administeredCompanyIds;

      if (!companyIds.length) {
        if (!companies.length) {
          return [];
        }

        setMemberships([]);
        if (!missingAdminWarningIssuedRef.current) {
          missingAdminWarningIssuedRef.current = true;
          enqueueNotification(
            'Tu usuario no figura en el campo admin_users de ninguna empresa, por lo que no hay membresías para administrar.',
            'warning'
          );
        }
        return [];
      }

      missingAdminWarningIssuedRef.current = false;
      setLoading(true);
      try {
        const aggregated: CompanyMembership[] = [];
        for (const companyId of companyIds) {
          const chunk = await loadCompanyMembershipsForCompany(companyId, { silent: true });
          aggregated.push(...chunk);
        }
        handleSyncSuccess({
          message:
            'Sincronizamos las solicitudes empresa por empresa respetando los administradores configurados en admin_users.',
          severity: 'info',
        });
        return aggregated;
      } catch (error) {
        handleSyncFailure('No pudimos sincronizar las membresías desde las empresas.', error);
        return membershipsRef.current;
      } finally {
        setLoading(false);
      }
    },
    [
      administeredCompanyIds,
      companies.length,
      enqueueNotification,
      handleSyncFailure,
      handleSyncSuccess,
      headers,
      loadCompanyMembershipsForCompany,
      setMemberships,
    ]
  );

  const loadCompanyMemberships = useCallback(
    async (companyId?: number | string | null): Promise<CompanyMembership[]> => {
      const numericCompanyId = coerceToNumber(companyId ?? undefined);
      if (numericCompanyId !== null) {
        return loadCompanyMembershipsForCompany(numericCompanyId);
      }

      if (!headers) {
        return membershipsRef.current;
      }

      return loadCompanyMembershipsFromCompanies();
    },
    [headers, loadCompanyMembershipsFromCompanies, loadCompanyMembershipsForCompany]
  );

  useEffect(() => {
    if (!headers) {
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(async () => {
        try {
          await loadCompanyMemberships();
        } finally {
          if (!disposed) {
            schedule();
          }
        }
      }, REFRESH_INTERVAL_MS);
    };

    loadCompanyMemberships();
    schedule();

    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [headers, loadCompanyMemberships]);

  useEffect(() => {
    if (!headers || !administeredCompanyIds.length) {
      return;
    }

    void loadCompanyMembershipsFromCompanies();
  }, [administeredCompanyIds, headers, loadCompanyMembershipsFromCompanies]);

  const streamingUrl = useMemo(
    () => buildMembershipStreamingUrl(membershipEndpoint, token),
    [membershipEndpoint, token]
  );

  useEffect(() => {
    if (!token || !headers || !streamingUrl) {
      setSupportsStreaming(false);
      streamingWarningIssuedRef.current = false;
      return;
    }

    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_HANDSHAKE_TIMEOUT_MS);

    const handleUnsupportedStreaming = (description?: string | null) => {
      setSupportsStreaming(false);
      if (!streamingWarningIssuedRef.current) {
        streamingWarningIssuedRef.current = true;
        enqueueNotification(
          'El servidor no expone el stream de membresías. Seguiremos en modo polling.',
          'warning',
          description ?? undefined
        );
      }
    };

    const verifyStreamingEndpoint = async () => {
      try {
        const response = await fetch(streamingUrl, {
          method: 'HEAD',
          headers,
          signal: controller.signal,
        });

        if (disposed) {
          return;
        }

        if (response.ok) {
          setSupportsStreaming(true);
          streamingWarningIssuedRef.current = false;
        } else {
          const description = `${response.status} ${response.statusText}`.trim();
          handleUnsupportedStreaming(description);
        }
      } catch (error) {
        if (disposed) {
          return;
        }

        const description = describeUnknownError(error);
        handleUnsupportedStreaming(description);
      } finally {
        clearTimeout(timeout);
      }
    };

    verifyStreamingEndpoint();

    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [enqueueNotification, headers, streamingUrl, token]);

  useEffect(() => {
    if (!token || !supportsStreaming || !streamingUrl) {
      return;
    }

    const globalObject = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const EventSourceCtor = globalObject?.EventSource as EventSourceConstructorLike | undefined;
    const WebSocketCtor = globalObject?.WebSocket as WebSocketConstructorLike | undefined;

    if (!EventSourceCtor && !WebSocketCtor) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    const handleStreamingMessage = (raw: string) => {
      if (!raw) {
        return;
      }

      const payload = parseJsonSafely(raw);
      const membership = extractMembershipFromPayload(payload ?? raw);
      if (membership) {
        mergeMembershipIntoState(membership);
        enqueueNotification(
          'Se recibieron cambios de membresías en vivo.',
          'info',
          `${membership.company_name} · ${membership.user_name}`
        );
      }
    };

    const tryEventSource = (): boolean => {
      if (!EventSourceCtor) {
        return false;
      }

      try {
        const eventSource = new EventSourceCtor(streamingUrl);
        eventSource.onmessage = event => handleStreamingMessage(event.data);
        eventSource.onerror = () => {
          if (disposed) {
            return;
          }
          enqueueNotification(
            'El canal SSE de membresías se cerró. Seguiremos sincronizando de forma periódica.',
            'warning'
          );
          eventSource.close();
        };
        cleanup = () => {
          disposed = true;
          eventSource.close();
        };
        return true;
      } catch (error) {
        reportOperationalError('No se pudo iniciar el canal SSE de membresías.', error);
        return false;
      }
    };

    const tryWebSocket = (): boolean => {
      if (!WebSocketCtor) {
        return false;
      }

      try {
        const ws = new WebSocketCtor(toWebSocketUrl(streamingUrl));
        ws.onmessage = event => handleStreamingMessage(event.data);
        ws.onerror = event => {
          if (disposed) {
            return;
          }
          reportOperationalError('El canal WebSocket de membresías falló.', event);
        };
        cleanup = () => {
          disposed = true;
          ws.close();
        };
        return true;
      } catch (error) {
        reportOperationalError('No se pudo iniciar el canal WebSocket de membresías.', error);
        return false;
      }
    };

    if (tryEventSource()) {
      return () => {
        cleanup?.();
      };
    }

    if (tryWebSocket()) {
      return () => {
        cleanup?.();
      };
    }

    return undefined;
  }, [
    enqueueNotification,
    mergeMembershipIntoState,
    reportOperationalError,
    streamingUrl,
    supportsStreaming,
    token,
  ]);

  const addCompanyMembership = useCallback(
    async (payload: CompanyMembershipPayload): Promise<CompanyMembership | null> => {
      if (!headers) {
        return null;
      }

      try {
        const response = await fetchMembershipResourceWithEndpoint('', () => ({
          method: 'POST',
          headers,
          body: JSON.stringify(serializePayload(payload)),
        }));

        const text = await response.text();
        if (!text) {
          await loadCompanyMemberships();
          return null;
        }

        let created: CompanyMembership | null = null;
        try {
          const json = JSON.parse(text);
          const single = parseMembership(json.membership ?? json.data ?? json);
          if (single) {
            created = single;
          }
        } catch (error) {
          reportOperationalError('No pudimos interpretar la respuesta al crear la membresía.', error);
        }

        if (created) {
          mergeMembershipIntoState(created);
          return created;
        }

        await loadCompanyMemberships();
      } catch (error) {
        reportOperationalError('Error al crear la membresía.', error);
      }

      return null;
    },
    [
      fetchMembershipResourceWithEndpoint,
      headers,
      loadCompanyMemberships,
      mergeMembershipIntoState,
      reportOperationalError,
    ]
  );

  const updateCompanyMembership = useCallback(
    async (id: number, payload: CompanyMembershipPayload): Promise<boolean> => {
      if (!headers) {
        return false;
      }

      try {
        const response = await fetchMembershipResourceWithEndpoint(`/${id}`, () => ({
          method: 'PUT',
          headers,
          body: JSON.stringify(serializePayload(payload)),
        }));

        if (!response.ok) {
          reportOperationalError('Error al actualizar la membresía.', `${response.status} ${response.statusText}`);
          return false;
        }

        const text = await response.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            const updated = parseMembership(json.membership ?? json.data ?? json);
            if (updated) {
              mergeMembershipIntoState(updated);
              return true;
            }
          } catch (error) {
            reportOperationalError('No pudimos interpretar la respuesta al actualizar la membresía.', error);
          }
        }

        await loadCompanyMemberships();
        return true;
      } catch (error) {
        reportOperationalError('Error al actualizar la membresía.', error);
        return false;
      }
    },
    [
      fetchMembershipResourceWithEndpoint,
      headers,
      loadCompanyMemberships,
      mergeMembershipIntoState,
      reportOperationalError,
    ]
  );

  const deleteCompanyMembership = useCallback(
    async (id: number): Promise<boolean> => {
      if (!headers) {
        return false;
      }

      try {
        const response = await fetchMembershipResourceWithEndpoint(`/${id}`, () => ({
          method: 'DELETE',
          headers,
        }));

        if (!response.ok) {
          reportOperationalError('Error al eliminar la membresía.', `${response.status} ${response.statusText}`);
          return false;
        }

        setMemberships(prev => prev.filter(item => item.id !== id));
        handleSyncSuccess();
        return true;
      } catch (error) {
        reportOperationalError('Error al eliminar la membresía.', error);
        return false;
      }
    },
    [
      fetchMembershipResourceWithEndpoint,
      handleSyncSuccess,
      headers,
      reportOperationalError,
      setMemberships,
    ]
  );

  const requestMembershipAccess = useCallback(
    async (
      companyId: number,
      options?: MembershipRequestOptions
    ): Promise<CompanyMembership | null> => {
      const numericCompanyId = coerceToNumber(companyId);
      const numericUserId = coerceToNumber(userId);

      if (numericCompanyId === null || numericUserId === null) {
        return null;
      }

      try {
        const body: Record<string, unknown> = {
          message: options?.message ?? null,
          role: options?.role ?? null,
          notes: options?.notes ?? null,
          request_template: options?.request_template ?? null,
          request_template_label: options?.request_template_label ?? null,
          position_title: options?.position_title ?? null,
          department: options?.department ?? null,
          started_at: options?.started_at ?? null,
          ended_at: options?.ended_at ?? null,
          employment_type: options?.employment_type ?? null,
          visibility: options?.visibility ?? null,
          profile_excerpt: options?.profile_excerpt ?? null,
        };

        const response = await postCompanyMembershipAction(
          numericCompanyId,
          null,
          '',
          body
        );

        const text = await response.text();
        const payload = parseJsonSafely(text);
        const errorPayload = payload ?? text;

        if (response.status === 401) {
          reportOperationalError('Solicitud de membresía sin autorización.', errorPayload);
          throw buildHttpError(
            response.status,
            'Tu sesión expiró. Iniciá sesión nuevamente para continuar.',
            errorPayload
          );
        }

        if (response.status === 422) {
          reportOperationalError('Solicitud de membresía inválida.', errorPayload);
          throw buildHttpError(
            response.status,
            'Los datos enviados no son válidos para registrar la solicitud.',
            errorPayload
          );
        }

        if (response.status === 409) {
          enqueueNotification(
            'Ya existe una solicitud activa para esta empresa.',
            'warning'
          );
          const payloadMembership = extractMembershipFromPayload(payload);
          if (payloadMembership) {
            mergeMembershipIntoState(payloadMembership);
            return payloadMembership;
          }

          const existingMembership = membershipsRef.current.find(
            membership =>
              membership.company_id === numericCompanyId && membership.user_id === numericUserId
          );
          if (existingMembership) {
            return existingMembership;
          }

          const refreshedMemberships = await loadCompanyMemberships();
          const refreshed = refreshedMemberships.find(
            membership =>
              membership.company_id === numericCompanyId && membership.user_id === numericUserId
          );
          if (refreshed) {
            return refreshed;
          }

          reportOperationalError(
            'Ya existe una solicitud activa para esta empresa, pero no pudimos recuperarla.',
            errorPayload
          );
          return null;
        }

        if (!response.ok) {
          reportOperationalError('No pudimos registrar la solicitud de acceso.', errorPayload);
          throw buildHttpError(
            response.status,
            'No pudimos registrar la solicitud de acceso.',
            errorPayload
          );
        }

        const membership = extractMembershipFromPayload(payload);
        if (membership) {
          mergeMembershipIntoState(membership);
          return membership;
        }

        await loadCompanyMemberships();
      } catch (error) {
        reportOperationalError('Error al solicitar acceso a la empresa.', error);
        throw error;
      }

      return null;
    },
    [
      enqueueNotification,
      loadCompanyMemberships,
      mergeMembershipIntoState,
      postCompanyMembershipAction,
      reportOperationalError,
      userId,
    ]
  );

  const updateMembershipStatus = useCallback(
    async (
      id: number,
      status: string,
      options?: MembershipStatusUpdateOptions
    ): Promise<CompanyMembership | null> => {
      if (!status) {
        return null;
      }

      const membership = memberships.find(item => item.id === id);
      if (!membership) {
        return null;
      }

      if (options?.decision) {
        const decisionSuffix = `/${options.decision}`;
        const body: Record<string, unknown> = {
          status,
          role: options.role ?? membership.role ?? null,
          notes: options.notes ?? membership.notes ?? null,
        };

        if (options.decision === 'reject') {
          body.reason = options.reason ?? membership.reason ?? null;
        }

        if (options.response_template !== undefined || membership.response_template !== undefined) {
          body.response_template = options.response_template ?? membership.response_template ?? null;
        }

        if (
          options.response_template_label !== undefined ||
          membership.response_template_label !== undefined
        ) {
          body.response_template_label =
            options.response_template_label ?? membership.response_template_label ?? null;
        }

        if (options.message !== undefined || membership.message !== undefined) {
          body.message = options.message ?? membership.message ?? null;
        }

        if (options.response_message !== undefined || membership.response_message !== undefined) {
          body.response_message = options.response_message ?? membership.response_message ?? null;
        }

        if (options.responded_at !== undefined || membership.responded_at !== undefined) {
          body.responded_at = options.responded_at ?? membership.responded_at ?? null;
        }

        if (options.audit_flags !== undefined || membership.audit_flags !== undefined) {
          body.audit_flags = options.audit_flags ?? membership.audit_flags ?? null;
        }

        if (options.response_channel !== undefined || membership.response_channel !== undefined) {
          body.response_channel = options.response_channel ?? membership.response_channel ?? null;
        }

        if (options.response_summary !== undefined || membership.response_summary !== undefined) {
          body.response_summary = options.response_summary ?? membership.response_summary ?? null;
        }

        try {
          const response = await postCompanyMembershipAction(
            membership.company_id,
            membership.id,
            decisionSuffix,
            body
          );
          const text = await response.text();
          const payload = parseJsonSafely(text);
          const errorPayload = payload ?? text;

          if (response.status === 401) {
            reportOperationalError('Actualización de membresía sin autorización.', errorPayload);
            throw buildHttpError(
              response.status,
              'No estás autorizado para responder la solicitud.',
              errorPayload
            );
          }

          if (response.status === 422) {
            reportOperationalError('Actualización de membresía inválida.', errorPayload);
            throw buildHttpError(
              response.status,
              'Los datos enviados no son válidos para responder la solicitud.',
              errorPayload
            );
          }

          if (!response.ok) {
            reportOperationalError('Error actualizando el estado de la membresía.', errorPayload);
            throw buildHttpError(
              response.status,
              'No pudimos actualizar el estado de la solicitud.',
              errorPayload
            );
          }

          const updated = extractMembershipFromPayload(payload);
          if (updated) {
            mergeMembershipIntoState(updated);
            return updated;
          }

          await loadCompanyMemberships();
          return null;
        } catch (error) {
          reportOperationalError('Error actualizando el estado de la membresía.', error);
          throw error;
        }
      }

      const ok = await updateCompanyMembership(id, {
        company_id: membership.company_id,
        user_id: membership.user_id,
        role: options?.role ?? membership.role ?? null,
        status,
        notes: options?.notes ?? membership.notes ?? null,
        reason: options?.reason ?? membership.reason ?? null,
        responded_at: options?.responded_at ?? membership.responded_at ?? null,
        audit_flags: options?.audit_flags ?? membership.audit_flags ?? null,
        response_template: options?.response_template ?? membership.response_template ?? null,
        response_template_label:
          options?.response_template_label ?? membership.response_template_label ?? null,
        response_message: options?.response_message ?? membership.response_message ?? null,
        response_channel: options?.response_channel ?? membership.response_channel ?? null,
        response_summary: options?.response_summary ?? membership.response_summary ?? null,
        request_template: membership.request_template ?? null,
        request_template_label: membership.request_template_label ?? null,
        message: options?.message ?? membership.message ?? null,
      });

      if (!ok) {
        return null;
      }

      const normalized = normalizeMembershipStatus(status);

      const fallback: CompanyMembership = {
        ...membership,
        role: options?.role ?? membership.role ?? null,
        status,
        notes: options?.notes ?? membership.notes ?? null,
        reason: options?.reason ?? membership.reason ?? null,
        responded_at: options?.responded_at ?? membership.responded_at ?? null,
        audit_flags: options?.audit_flags ?? membership.audit_flags ?? null,
        normalized_status: normalized,
        response_template: options?.response_template ?? membership.response_template ?? null,
        response_template_label:
          options?.response_template_label ?? membership.response_template_label ?? null,
        response_message: options?.response_message ?? membership.response_message ?? null,
        response_channel: options?.response_channel ?? membership.response_channel ?? null,
        response_summary: options?.response_summary ?? membership.response_summary ?? null,
        message: options?.message ?? membership.message ?? null,
      };
      mergeMembershipIntoState(fallback);
      return fallback;
    },
    [
      loadCompanyMemberships,
      mergeMembershipIntoState,
      memberships,
      postCompanyMembershipAction,
      reportOperationalError,
      updateCompanyMembership,
    ]
  );

  const value = useMemo(
    () => ({
      memberships,
      hydrated,
      loading,
      lastSyncedAt,
      syncError,
      isStale,
      notifications,
      statusCatalog: MEMBERSHIP_STATUS_OPTIONS,
      roleCatalog: MEMBERSHIP_ROLE_SUGGESTIONS,
      normalizeStatus: normalizeMembershipStatus,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
      requestMembershipAccess,
      updateMembershipStatus,
      enqueueNotification,
      dismissNotification,
      clearNotifications,
      clearSyncError,
    }),
    [
      memberships,
      hydrated,
      loading,
      lastSyncedAt,
      syncError,
      isStale,
      notifications,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
      requestMembershipAccess,
      updateMembershipStatus,
      enqueueNotification,
      dismissNotification,
      clearNotifications,
      clearSyncError,
    ]
  );

  return (
    <CompanyMembershipsContext.Provider value={value}>
      {children}
    </CompanyMembershipsContext.Provider>
  );
};

