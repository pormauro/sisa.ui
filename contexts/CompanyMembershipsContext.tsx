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
}

export interface MembershipRequestOptions {
  role?: string | null;
  status?: string | null;
  notes?: string | null;
  message?: string | null;
}

export interface MembershipStatusUpdateOptions {
  role?: string | null;
  notes?: string | null;
  reason?: string | null;
  responded_at?: string | null;
  audit_flags?: MembershipAuditFlags | null;
}

interface CompanyMembershipsContextValue {
  memberships: CompanyMembership[];
  hydrated: boolean;
  loading: boolean;
  loadCompanyMemberships: () => Promise<void>;
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
  ) => Promise<boolean>;
}

const defaultContextValue: CompanyMembershipsContextValue = {
  memberships: [],
  hydrated: false,
  loading: false,
  loadCompanyMemberships: async () => {},
  addCompanyMembership: async () => null,
  updateCompanyMembership: async () => false,
  deleteCompanyMembership: async () => false,
  requestMembershipAccess: async () => null,
  updateMembershipStatus: async () => false,
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
    status: getString(raw.status) ?? getString(raw.membership_status),
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

  return body;
};

const MEMBERSHIP_ENDPOINT_VARIANTS = ['/company_memberships', '/company-memberships'] as const;

const fetchMembershipResource = async (
  suffix = '',
  init?: RequestInit | (() => RequestInit)
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
    const response = await fetch(`${BASE_URL}${basePath}${normalizedSuffix}`, buildOptions());
    if (response.status !== 404 || index === MEMBERSHIP_ENDPOINT_VARIANTS.length - 1) {
      return response;
    }
  }

  throw new Error('Unable to resolve company memberships endpoint');
};

export const CompanyMembershipsProvider = ({ children }: { children: ReactNode }) => {
  const { token, userId } = useContext(AuthContext);
  const [memberships, setMemberships, hydrated] = useCachedState<CompanyMembership[]>(
    'company_memberships',
    []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setMemberships(prev => prev.map(item => parseMembership(item) ?? item));
  }, [hydrated, setMemberships]);

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

  const loadCompanyMemberships = useCallback(async () => {
    if (!headers) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetchMembershipResource('', { headers });

      if (response.status === 404) {
        setMemberships([]);
        return;
      }

      if (!response.ok) {
        console.error('Error loading company memberships:', response.status, response.statusText);
        return;
      }

      const text = await response.text();
      if (!text) {
        setMemberships([]);
        return;
      }

      try {
        const json = JSON.parse(text);
        setMemberships(normalizeCollection(json));
      } catch (error) {
        console.error('Unable to parse company memberships payload:', error);
      }
    } catch (error) {
      console.error('Error loading company memberships:', error);
    } finally {
      setLoading(false);
    }
  }, [headers, setMemberships]);

  const addCompanyMembership = useCallback(
    async (payload: CompanyMembershipPayload): Promise<CompanyMembership | null> => {
      if (!headers) {
        return null;
      }

      try {
        const response = await fetchMembershipResource('', () => ({
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
          console.error('Unable to parse response while adding company membership:', error);
        }

        if (created) {
          setMemberships(prev => {
            const filtered = prev.filter(item => item.id !== created!.id);
            return [created!, ...filtered];
          });
          return created;
        }

        await loadCompanyMemberships();
      } catch (error) {
        console.error('Error adding company membership:', error);
      }

      return null;
    },
    [headers, loadCompanyMemberships, setMemberships]
  );

  const updateCompanyMembership = useCallback(
    async (id: number, payload: CompanyMembershipPayload): Promise<boolean> => {
      if (!headers) {
        return false;
      }

      try {
        const response = await fetchMembershipResource(`/${id}`, () => ({
          method: 'PUT',
          headers,
          body: JSON.stringify(serializePayload(payload)),
        }));

        if (!response.ok) {
          console.error('Error updating company membership:', response.status, response.statusText);
          return false;
        }

        const text = await response.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            const updated = parseMembership(json.membership ?? json.data ?? json);
            if (updated) {
              setMemberships(prev =>
                prev.map(item => (item.id === id ? { ...item, ...updated } : item))
              );
              return true;
            }
          } catch (error) {
            console.error('Unable to parse updated company membership payload:', error);
          }
        }

        await loadCompanyMemberships();
        return true;
      } catch (error) {
        console.error('Error updating company membership:', error);
        return false;
      }
    },
    [headers, loadCompanyMemberships, setMemberships]
  );

  const deleteCompanyMembership = useCallback(
    async (id: number): Promise<boolean> => {
      if (!headers) {
        return false;
      }

      try {
        const response = await fetchMembershipResource(`/${id}`, () => ({
          method: 'DELETE',
          headers,
        }));

        if (!response.ok) {
          console.error('Error deleting company membership:', response.status, response.statusText);
          return false;
        }

        setMemberships(prev => prev.filter(item => item.id !== id));
        return true;
      } catch (error) {
        console.error('Error deleting company membership:', error);
        return false;
      }
    },
    [headers, setMemberships]
  );

  const requestMembershipAccess = useCallback(
    async (
      companyId: number,
      options?: MembershipRequestOptions
    ): Promise<CompanyMembership | null> => {
      if (!headers) {
        return null;
      }

      const numericCompanyId = coerceToNumber(companyId);
      const numericUserId = coerceToNumber(userId);

      if (numericCompanyId === null || numericUserId === null) {
        return null;
      }

      const targetStatus = options?.status ?? 'pending';

      const existing = memberships.find(
        membership =>
          membership.company_id === numericCompanyId && membership.user_id === numericUserId
      );

      if (existing) {
        const normalizedTarget =
          typeof targetStatus === 'string' ? targetStatus.trim().toLowerCase() : '';
        const normalizedCurrent =
          typeof existing.status === 'string' ? existing.status.trim().toLowerCase() : '';

        if (normalizedTarget && normalizedTarget !== normalizedCurrent) {
          await updateCompanyMembership(existing.id, {
            company_id: existing.company_id,
            user_id: existing.user_id,
            role: options?.role ?? existing.role ?? null,
            status: targetStatus,
            notes: options?.notes ?? existing.notes ?? null,
            reason: existing.reason ?? null,
            responded_at: existing.responded_at ?? null,
            audit_flags: existing.audit_flags ?? null,
          });
        }

        return existing;
      }

      return addCompanyMembership({
        company_id: numericCompanyId,
        user_id: numericUserId,
        role: options?.role ?? null,
        status: targetStatus,
        notes: options?.notes ?? null,
        message: options?.message ?? null,
      });
    },
    [
      addCompanyMembership,
      headers,
      memberships,
      updateCompanyMembership,
      userId,
    ]
  );

  const updateMembershipStatus = useCallback(
    async (
      id: number,
      status: string,
      options?: MembershipStatusUpdateOptions
    ): Promise<boolean> => {
      if (!status) {
        return false;
      }

      const membership = memberships.find(item => item.id === id);
      if (!membership) {
        return false;
      }

      return updateCompanyMembership(id, {
        company_id: membership.company_id,
        user_id: membership.user_id,
        role: options?.role ?? membership.role ?? null,
        status,
        notes: options?.notes ?? membership.notes ?? null,
        reason: options?.reason ?? membership.reason ?? null,
        responded_at: options?.responded_at ?? membership.responded_at ?? null,
        audit_flags: options?.audit_flags ?? membership.audit_flags ?? null,
      });
    },
    [memberships, updateCompanyMembership]
  );

  const value = useMemo(
    () => ({
      memberships,
      hydrated,
      loading,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
      requestMembershipAccess,
      updateMembershipStatus,
    }),
    [
      memberships,
      hydrated,
      loading,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
      requestMembershipAccess,
      updateMembershipStatus,
    ]
  );

  return (
    <CompanyMembershipsContext.Provider value={value}>
      {children}
    </CompanyMembershipsContext.Provider>
  );
};

