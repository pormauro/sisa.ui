import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
  useRef,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { getDefaultSortValue, sortByNewest } from '@/utils/sort';

export const MEMBERSHIP_STATUSES = [
  'pending',
  'invited',
  'approved',
  'rejected',
  'cancelled',
  'left',
  'removed',
  'suspended',
] as const;

export type CompanyMembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type MembershipStatusFilter = CompanyMembershipStatus | 'all';

export interface CompanyMembership {
  id: number;
  company_id: number;
  user_id: number;
  role: string | null;
  user_full_name?: string | null;
  username?: string | null;
  user_email?: string | null;
  status: CompanyMembershipStatus;
  position_title?: string | null;
  department?: string | null;
  employment_type?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  visibility?: string | null;
  profile_excerpt?: string | null;
  message?: string | null;
  invitation_token?: string | null;
  expires_at?: string | null;
  invited_by?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CompanyMembershipHistoryEntry {
  id?: number;
  membership_id: number;
  operation_type: string;
  notes?: string | null;
  reason?: string | null;
  changed_by?: number | null;
  changed_at?: string | null;
  previous_state?: CompanyMembershipStatus | null;
  new_state?: CompanyMembershipStatus | null;
  metadata_snapshot?: Record<string, unknown> | null;
}

export interface MembershipRequestPayload {
  message?: string;
  role?: string;
  position_title?: string;
  department?: string;
  employment_type?: string;
  started_at?: string;
  ended_at?: string;
  visibility?: string;
  profile_excerpt?: string;
}

export interface MembershipInvitationPayload {
  user_id: number;
  role?: string;
  expires_at?: string;
  invitation_message?: string;
  position_title?: string;
  department?: string;
  employment_type?: string;
  started_at?: string;
  visibility?: string;
  profile_excerpt?: string;
}

export interface MembershipApprovalPayload {
  role?: string;
  notes?: string;
}

export interface MembershipRejectionPayload {
  reason?: string;
  notes?: string;
}

export interface MembershipNotesPayload {
  notes?: string;
}

type MembershipHistoryState = Record<number, Record<number, CompanyMembershipHistoryEntry[]>>;
type MembershipCollection = Partial<Record<string, CompanyMembership[]>>;

type MembershipStore = Record<number, MembershipCollection>;

export type MembershipRoleFilter = 'member' | 'admin' | 'owner' | 'all';

interface CompanyMembershipsContextValue {
  membershipsByCompany: MembershipStore;
  membershipHistories: MembershipHistoryState;
  getMemberships: (
    companyId: number,
    status?: MembershipStatusFilter,
    role?: MembershipRoleFilter,
  ) => CompanyMembership[];
  loadMemberships: (
    companyId: number,
    status?: MembershipStatusFilter,
    role?: MembershipRoleFilter,
  ) => Promise<CompanyMembership[]>;
  getMembershipHistory: (companyId: number, membershipId: number) => CompanyMembershipHistoryEntry[];
  loadMembershipHistory: (
    companyId: number,
    membershipId: number,
  ) => Promise<CompanyMembershipHistoryEntry[]>;
  requestMembership: (
    companyId: number,
    payload: MembershipRequestPayload,
  ) => Promise<boolean>;
  inviteMember: (
    companyId: number,
    payload: MembershipInvitationPayload,
  ) => Promise<boolean>;
  acceptInvitation: (
    companyId: number,
    membershipId: number,
    token: string,
  ) => Promise<boolean>;
  cancelInvitation: (
    companyId: number,
    membershipId: number,
    payload?: MembershipNotesPayload,
  ) => Promise<boolean>;
  approveMembership: (
    companyId: number,
    membershipId: number,
    payload?: MembershipApprovalPayload,
  ) => Promise<boolean>;
  rejectMembership: (
    companyId: number,
    membershipId: number,
    payload?: MembershipRejectionPayload,
  ) => Promise<boolean>;
  leaveMembership: (
    companyId: number,
    membershipId: number,
    payload?: MembershipNotesPayload,
  ) => Promise<boolean>;
  suspendMember: (
    companyId: number,
    membershipId: number,
    payload?: MembershipNotesPayload,
  ) => Promise<boolean>;
  removeMember: (
    companyId: number,
    membershipId: number,
    payload?: MembershipNotesPayload,
  ) => Promise<boolean>;
  canManageMemberships: boolean;
  canListMemberships: boolean;
  canInviteMembers: boolean;
  canCancelInvitations: boolean;
  canApproveMemberships: boolean;
  canRejectMemberships: boolean;
  canAcceptInvitations: boolean;
  canRequestMembership: boolean;
  canLeaveCompany: boolean;
  canSuspendMembers: boolean;
  canRemoveMembers: boolean;
  canViewHistory: boolean;
}

const defaultContextValue: CompanyMembershipsContextValue = {
  membershipsByCompany: {},
  membershipHistories: {},
  getMemberships: () => [],
  loadMemberships: async () => [],
  getMembershipHistory: () => [],
  loadMembershipHistory: async () => [],
  requestMembership: async () => false,
  inviteMember: async () => false,
  acceptInvitation: async () => false,
  cancelInvitation: async () => false,
  approveMembership: async () => false,
  rejectMembership: async () => false,
  leaveMembership: async () => false,
  suspendMember: async () => false,
  removeMember: async () => false,
  canManageMemberships: false,
  canListMemberships: false,
  canInviteMembers: false,
  canCancelInvitations: false,
  canApproveMemberships: false,
  canRejectMemberships: false,
  canAcceptInvitations: false,
  canRequestMembership: false,
  canLeaveCompany: false,
  canSuspendMembers: false,
  canRemoveMembers: false,
  canViewHistory: false,
};

export const CompanyMembershipsContext =
  createContext<CompanyMembershipsContextValue>(defaultContextValue);

const VALID_STATUS = new Set<CompanyMembershipStatus>(MEMBERSHIP_STATUSES);

const parseMembershipStatus = (value: unknown): CompanyMembershipStatus => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'canceled') {
      return 'cancelled';
    }
    if (VALID_STATUS.has(normalized as CompanyMembershipStatus)) {
      return normalized as CompanyMembershipStatus;
    }
  }
  return 'pending';
};

const normalizeRoleValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const buildMembershipCacheKey = (
  status: MembershipStatusFilter,
  role: MembershipRoleFilter,
): string => `${status}|${role}`;

const filterMembershipsByRole = (
  memberships: CompanyMembership[],
  role: MembershipRoleFilter,
): CompanyMembership[] => {
  if (role === 'all') {
    return memberships;
  }

  return memberships.filter(membership => {
    const normalizedRole = membership.role?.trim().toLowerCase();
    if (normalizedRole === 'administrator' && role === 'admin') {
      return true;
    }
    return normalizedRole === role;
  });
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const pickNumericValue = (
  record: Record<string, unknown>,
  keys: string[],
): number | null => {
  for (const key of keys) {
    if (key in record) {
      const value = toNullableNumber(record[key]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
};

const normalizeMembership = (raw: unknown): CompanyMembership | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const nestedCompany = record.company && typeof record.company === 'object'
    ? (record.company as Record<string, unknown>)
    : {};
  const nestedUser = record.user && typeof record.user === 'object'
    ? (record.user as Record<string, unknown>)
    : {};

  const id =
    pickNumericValue(record, ['id', 'membership_id', 'membershipId']) ??
    pickNumericValue(record, ['membership']);
  if (id === null) {
    return null;
  }

  const companyId =
    pickNumericValue(record, ['company_id', 'companyId']) ??
    pickNumericValue(nestedCompany, ['id']);
  const userId =
    pickNumericValue(record, ['user_id', 'userId']) ??
    pickNumericValue(nestedUser, ['id']);

  return {
    id,
    company_id: companyId ?? 0,
    user_id: userId ?? 0,
    role:
      normalizeRoleValue(record.role) ??
      normalizeRoleValue(record.role_name) ??
      normalizeRoleValue(record['roleName']) ??
      null,
    user_full_name:
      normalizeRoleValue(record.user_full_name) ??
      normalizeRoleValue(record.userFullName) ??
      normalizeRoleValue(nestedUser.full_name) ??
      normalizeRoleValue(nestedUser.fullName),
    username:
      normalizeRoleValue(record.username) ??
      normalizeRoleValue(nestedUser.username),
    user_email:
      normalizeRoleValue(record.user_email) ??
      normalizeRoleValue(record.userEmail) ??
      normalizeRoleValue(record.email) ??
      normalizeRoleValue(nestedUser.email),
    status:
      parseMembershipStatus(
        record.status ?? record.state ?? record['membership_status'],
      ),
    position_title:
      toNullableString(record.position_title) ??
      toNullableString(record.positionTitle),
    department: toNullableString(record.department),
    employment_type:
      toNullableString(record.employment_type) ??
      toNullableString(record.employmentType),
    started_at:
      toNullableString(record.started_at) ??
      toNullableString(record.startedAt),
    ended_at:
      toNullableString(record.ended_at) ?? toNullableString(record.endedAt),
    visibility: toNullableString(record.visibility),
    profile_excerpt:
      toNullableString(record.profile_excerpt) ??
      toNullableString(record.profileExcerpt),
    message: toNullableString(record.message),
    invitation_token:
      toNullableString(record.invitation_token) ??
      toNullableString(record.invitationToken),
    expires_at:
      toNullableString(record.expires_at) ?? toNullableString(record.expiresAt),
    invited_by:
      pickNumericValue(record, ['invited_by', 'invitedBy']) ??
      pickNumericValue(nestedUser, ['invited_by', 'invitedBy']),
    notes: toNullableString(record.notes),
    created_at:
      toNullableString(record.created_at) ??
      toNullableString(record.createdAt),
    updated_at:
      toNullableString(record.updated_at) ??
      toNullableString(record.updatedAt),
  };
};

const getMembershipList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidateKeys = ['memberships', 'data', 'items', 'results'];
    for (const key of candidateKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }
  return [];
};

const parseMembershipList = (payload: unknown): CompanyMembership[] =>
  getMembershipList(payload)
    .map(item => normalizeMembership(item))
    .filter((item): item is CompanyMembership => Boolean(item));

const parseMetadataSnapshot = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
};

const normalizeHistoryEntry = (raw: unknown): CompanyMembershipHistoryEntry | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const membershipId =
    pickNumericValue(record, ['membership_id', 'membershipId']) ?? 0;
  return {
    id:
      pickNumericValue(record, ['id', 'event_id', 'history_id']) ??
      undefined,
    membership_id: membershipId,
    operation_type:
      toNullableString(record.operation_type) ??
      toNullableString(record.type) ??
      'unknown',
    notes: toNullableString(record.notes),
    reason: toNullableString(record.reason),
    changed_by:
      pickNumericValue(record, ['changed_by', 'user_id', 'changedBy']) ?? null,
    changed_at:
      toNullableString(record.changed_at) ??
      toNullableString(record.changedAt),
    previous_state:
      record.previous_state || record.previousState
        ? parseMembershipStatus(record.previous_state ?? record.previousState)
        : null,
    new_state:
      record.new_state || record.newState
        ? parseMembershipStatus(record.new_state ?? record.newState)
        : null,
    metadata_snapshot: parseMetadataSnapshot(record.metadata_snapshot),
  };
};

const parseHistoryList = (payload: unknown): CompanyMembershipHistoryEntry[] => {
  if (Array.isArray(payload)) {
    return payload
      .map(item => normalizeHistoryEntry(item))
      .filter((item): item is CompanyMembershipHistoryEntry => Boolean(item));
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const keys = ['history', 'events', 'data', 'items'];
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value
          .map(item => normalizeHistoryEntry(item))
          .filter((item): item is CompanyMembershipHistoryEntry => Boolean(item));
      }
    }
  }
  return [];
};

const sortHistory = (events: CompanyMembershipHistoryEntry[]): CompanyMembershipHistoryEntry[] => {
  return [...events].sort((a, b) => {
    const aDate = a.changed_at ?? '';
    const bDate = b.changed_at ?? '';
    const diff = Date.parse(bDate) - Date.parse(aDate);
    if (!Number.isNaN(diff) && diff !== 0) {
      return diff;
    }
    const aId = a.id ?? 0;
    const bId = b.id ?? 0;
    return bId - aId;
  });
};

const compactPayload = <T extends Record<string, unknown>>(payload: T): T => {
  const result: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('No fue posible interpretar la respuesta del módulo de membresías.', error);
    return null;
  }
};

export const CompanyMembershipsProvider = ({ children }: { children: ReactNode }) => {
  const [membershipsByCompany, setMembershipsByCompany] = useCachedState<MembershipStore>(
    'companyMemberships',
    {},
  );
  const membershipsStoreRef = useRef<MembershipStore>(membershipsByCompany);
  const [membershipHistories, setMembershipHistories] = useCachedState<MembershipHistoryState>(
    'companyMembershipHistories',
    {},
  );
  const { token, checkConnection } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  useEffect(() => {
    membershipsStoreRef.current = membershipsByCompany;
  }, [membershipsByCompany]);

  const hasAnyPermission = useCallback(
    (candidates: string | string[]) => {
      const list = Array.isArray(candidates) ? candidates : [candidates];
      return list.some(permission => permissions.includes(permission));
    },
    [permissions],
  );

  const canManageMemberships = useMemo(
    () => hasAnyPermission('manageCompanyMemberships'),
    [hasAnyPermission],
  );

  const canListMemberships = useMemo(
    () =>
      canManageMemberships ||
      hasAnyPermission(['listCompanyMembers', 'listUserCompanyMemberships']),
    [canManageMemberships, hasAnyPermission],
  );

  const canInviteMembers = useMemo(
    () => canManageMemberships || hasAnyPermission('inviteCompanyMembers'),
    [canManageMemberships, hasAnyPermission],
  );

  const canCancelInvitations = useMemo(
    () => canManageMemberships || hasAnyPermission('cancelCompanyInvitations'),
    [canManageMemberships, hasAnyPermission],
  );

  const canApproveMemberships = useMemo(
    () => canManageMemberships || hasAnyPermission('reactivateCompanyMember'),
    [canManageMemberships, hasAnyPermission],
  );

  const canRejectMemberships = useMemo(() => canManageMemberships, [canManageMemberships]);

  const canAcceptInvitations = useMemo(
    () => canManageMemberships || hasAnyPermission('acceptCompanyInvitation'),
    [canManageMemberships, hasAnyPermission],
  );

  const canRequestMembership = useMemo(
    () => canManageMemberships || hasAnyPermission('requestCompanyMembership'),
    [canManageMemberships, hasAnyPermission],
  );

  const canLeaveCompany = useMemo(
    () => canManageMemberships || hasAnyPermission('leaveCompanyMembership'),
    [canManageMemberships, hasAnyPermission],
  );

  const canSuspendMembers = useMemo(
    () => canManageMemberships || hasAnyPermission('suspendCompanyMember'),
    [canManageMemberships, hasAnyPermission],
  );

  const canRemoveMembers = useMemo(
    () => canManageMemberships || hasAnyPermission('removeCompanyMember'),
    [canManageMemberships, hasAnyPermission],
  );

  const canViewHistory = useMemo(() => canManageMemberships, [canManageMemberships]);

  const getMembershipsFromStore = useCallback(
    (
      companyId: number,
      status: MembershipStatusFilter = 'approved',
      role: MembershipRoleFilter = 'all',
    ) => {
      const byCompany = membershipsStoreRef.current[companyId];
      if (!byCompany) {
        return [];
      }
      return byCompany[buildMembershipCacheKey(status, role)] ?? [];
    },
    [],
  );

  const getMemberships = useCallback(
    (
      companyId: number,
      status: MembershipStatusFilter = 'approved',
      role: MembershipRoleFilter = 'all',
    ) => getMembershipsFromStore(companyId, status, role),
    [getMembershipsFromStore],
  );

  const getMembershipHistory = useCallback(
    (companyId: number, membershipId: number) => {
      const companyHistory = membershipHistories[companyId];
      if (!companyHistory) {
        return [];
      }
      return companyHistory[membershipId] ?? [];
    },
    [membershipHistories],
  );

  const clearCompanyMemberships = useCallback(
    (companyId: number) => {
      setMembershipsByCompany(prev => {
        if (!(companyId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[companyId];
        return next;
      });
    },
    [setMembershipsByCompany],
  );

  const clearMembershipHistory = useCallback(
    (companyId: number, membershipId: number) => {
      setMembershipHistories(prev => {
        const companyHistory = prev[companyId];
        if (!companyHistory || !(membershipId in companyHistory)) {
          return prev;
        }
        const nextCompanyHistory = { ...companyHistory };
        delete nextCompanyHistory[membershipId];
        const next = { ...prev };
        if (Object.keys(nextCompanyHistory).length === 0) {
          delete next[companyId];
        } else {
          next[companyId] = nextCompanyHistory;
        }
        return next;
      });
    },
    [setMembershipHistories],
  );

  const loadMemberships = useCallback(
    async (
      companyId: number,
      status: MembershipStatusFilter = 'approved',
      role: MembershipRoleFilter = 'all',
    ) => {
      if (!token || !canListMemberships) {
        return getMembershipsFromStore(companyId, status, role);
      }
      try {
        const params = new URLSearchParams();
        if (status) {
          params.append('status', status);
        }
        if (role && role !== 'all') {
          params.append('role', role);
        }
        const query = params.toString();
        const response = await fetch(
          `${BASE_URL}/companies/${companyId}/memberships${query ? `?${query}` : ''}`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        if (!response.ok) {
          console.error('Error al listar membresías de empresa:', response.status);
          return getMembershipsFromStore(companyId, status, role);
        }
        const payload = await response.json();
        const parsed = filterMembershipsByRole(
          sortByNewest(parseMembershipList(payload), getDefaultSortValue),
          role,
        );
        setMembershipsByCompany(prev => ({
          ...prev,
          [companyId]: {
            ...(prev[companyId] ?? {}),
            [buildMembershipCacheKey(status, role)]: parsed,
          },
        }));
        return parsed;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar membresías de empresa.');
          return getMembershipsFromStore(companyId, status, role);
        }
        console.error('Error inesperado al cargar membresías de empresa.', error);
        return getMembershipsFromStore(companyId, status, role);
      }
    },
    [
      token,
      canListMemberships,
      setMembershipsByCompany,
      checkConnection,
      getMembershipsFromStore,
    ],
  );

  const loadMembershipHistory = useCallback(
    async (companyId: number, membershipId: number) => {
      if (!token || !canViewHistory) {
        return getMembershipHistory(companyId, membershipId);
      }
      try {
        const response = await fetch(
          `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/history`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        if (!response.ok) {
          console.error('Error al obtener el historial de membresía:', response.status);
          return getMembershipHistory(companyId, membershipId);
        }
        const payload = await response.json();
        const parsed = sortHistory(parseHistoryList(payload));
        setMembershipHistories(prev => ({
          ...prev,
          [companyId]: {
            ...(prev[companyId] ?? {}),
            [membershipId]: parsed,
          },
        }));
        return parsed;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al recuperar el historial de membresía.');
          return getMembershipHistory(companyId, membershipId);
        }
        console.error('Error inesperado al recuperar el historial de membresía.', error);
        return getMembershipHistory(companyId, membershipId);
      }
    },
    [
      token,
      canViewHistory,
      getMembershipHistory,
      setMembershipHistories,
      checkConnection,
    ],
  );

  const handleMembershipMutation = useCallback(
    async (
      url: string,
      options: RequestInit,
      companyId: number,
      membershipId?: number,
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers ?? {}),
          },
        });
        await ensureAuthResponse(response, { onUnauthorized: checkConnection });
        if (!response.ok) {
          const details = await parseJsonSafely(response);
          console.error('La API rechazó la operación sobre membresías.', details);
          return false;
        }
        if (membershipId) {
          clearMembershipHistory(companyId, membershipId);
        }
        clearCompanyMemberships(companyId);
        return true;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al operar sobre membresías de empresa.');
          return false;
        }
        console.error('Error inesperado al operar sobre membresías.', error);
        return false;
      }
    },
    [token, checkConnection, clearCompanyMemberships, clearMembershipHistory],
  );

  const requestMembership = useCallback(
    async (companyId: number, payload: MembershipRequestPayload) => {
      if (!canRequestMembership) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships`,
        {
          method: 'POST',
          body: JSON.stringify(compactPayload(payload)),
        },
        companyId,
      );
    },
    [canRequestMembership, handleMembershipMutation],
  );

  const inviteMember = useCallback(
    async (companyId: number, payload: MembershipInvitationPayload) => {
      if (!canInviteMembers) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/invite`,
        {
          method: 'POST',
          body: JSON.stringify(compactPayload(payload)),
        },
        companyId,
      );
    },
    [canInviteMembers, handleMembershipMutation],
  );

  const acceptInvitation = useCallback(
    async (companyId: number, membershipId: number, tokenValue: string) => {
      if (!canAcceptInvitations) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ token: tokenValue }),
        },
        companyId,
        membershipId,
      );
    },
    [canAcceptInvitations, handleMembershipMutation],
  );

  const cancelInvitation = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipNotesPayload) => {
      if (!canCancelInvitations) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/cancel-invitation`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canCancelInvitations, handleMembershipMutation],
  );

  const approveMembership = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipApprovalPayload) => {
      if (!canApproveMemberships) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/approve`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canApproveMemberships, handleMembershipMutation],
  );

  const rejectMembership = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipRejectionPayload) => {
      if (!canRejectMemberships) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/reject`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canRejectMemberships, handleMembershipMutation],
  );

  const leaveMembership = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipNotesPayload) => {
      if (!canLeaveCompany) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/leave`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canLeaveCompany, handleMembershipMutation],
  );

  const suspendMember = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipNotesPayload) => {
      if (!canSuspendMembers) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/suspend`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canSuspendMembers, handleMembershipMutation],
  );

  const removeMember = useCallback(
    async (companyId: number, membershipId: number, payload?: MembershipNotesPayload) => {
      if (!canRemoveMembers) {
        return false;
      }
      return handleMembershipMutation(
        `${BASE_URL}/companies/${companyId}/memberships/${membershipId}/remove`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(compactPayload(payload)) : undefined,
        },
        companyId,
        membershipId,
      );
    },
    [canRemoveMembers, handleMembershipMutation],
  );

  return (
    <CompanyMembershipsContext.Provider
      value={{
        membershipsByCompany,
        membershipHistories,
        getMemberships,
        loadMemberships,
        getMembershipHistory,
        loadMembershipHistory,
        requestMembership,
        inviteMember,
        acceptInvitation,
        cancelInvitation,
        approveMembership,
        rejectMembership,
        leaveMembership,
        suspendMember,
        removeMember,
        canManageMemberships,
        canListMemberships,
        canInviteMembers,
        canCancelInvitations,
        canApproveMemberships,
        canRejectMemberships,
        canAcceptInvitations,
        canRequestMembership,
        canLeaveCompany,
        canSuspendMembers,
        canRemoveMembers,
        canViewHistory,
      }}
    >
      {children}
    </CompanyMembershipsContext.Provider>
  );
};
