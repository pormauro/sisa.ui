import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { CompaniesContext, type Company } from '@/contexts/CompaniesContext';
import { type CompanyMembershipStatus, MEMBERSHIP_STATUSES } from '@/contexts/CompanyMembershipsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

export interface MemberCompanyRecord {
  membershipId: number;
  companyId: number;
  role: string | null;
  status: CompanyMembershipStatus;
  visibility: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MemberCompaniesContextValue {
  memberships: MemberCompanyRecord[];
  memberCompanies: Company[];
  isLoadingMemberCompanies: boolean;
  loadMemberCompanies: () => Promise<MemberCompanyRecord[]>;
  refreshMemberCompanies: () => Promise<MemberCompanyRecord[]>;
}

const defaultContextValue: MemberCompaniesContextValue = {
  memberships: [],
  memberCompanies: [],
  isLoadingMemberCompanies: false,
  loadMemberCompanies: async () => [],
  refreshMemberCompanies: async () => [],
};

export const MemberCompaniesContext = createContext<MemberCompaniesContextValue>(defaultContextValue);

const parseNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseMembershipStatus = (value: unknown): CompanyMembershipStatus => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const fallback: CompanyMembershipStatus = 'approved';
  return (MEMBERSHIP_STATUSES.find(status => status === normalized) as CompanyMembershipStatus) ?? fallback;
};

const parseMemberRecord = (raw: any): MemberCompanyRecord | null => {
  const companyId = parseNumericId(raw?.company_id ?? raw?.empresa_id);
  const membershipId = parseNumericId(raw?.id ?? raw?.membership_id);

  if (!companyId || !membershipId) {
    return null;
  }

  return {
    membershipId,
    companyId,
    role: typeof raw?.role === 'string' ? raw.role : typeof raw?.rol === 'string' ? raw.rol : null,
    status: parseMembershipStatus(raw?.status ?? raw?.estado),
    visibility: typeof raw?.visibility === 'string' ? raw.visibility : null,
    created_at: typeof raw?.created_at === 'string' ? raw.created_at : null,
    updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : null,
  };
};

export const MemberCompaniesProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, checkConnection } = useContext(AuthContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);

  const [memberships, setMemberships] = useCachedState<MemberCompanyRecord[]>(
    'member-companies-memberships',
    [],
  );
  const [isLoadingMemberCompanies, setIsLoadingMemberCompanies] = useState(false);
  const hasRequestedCompanies = useRef(false);
  const membershipsRef = useRef<MemberCompanyRecord[]>(memberships);

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  const memberCompanies = useMemo(() => {
    const allowedIds = new Set(memberships.map(record => record.companyId));
    return companies.filter(company => allowedIds.has(company.id));
  }, [companies, memberships]);

  const loadMemberCompanies = useCallback(async () => {
    if (!token) {
      return membershipsRef.current;
    }

    setIsLoadingMemberCompanies(true);
    try {
      const response = await fetch(
        `${BASE_URL}/companies/member?status=approved&role=owner,admin,member`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      await ensureAuthResponse(response, { onUnauthorized: checkConnection });

      if (!response.ok) {
        console.error('No se pudo cargar el listado de empresas del usuario.', response.status);
        return membershipsRef.current;
      }

      const payload = await response.json();
      const collection = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      const parsed = collection
        .map(parseMemberRecord)
        .filter((record): record is MemberCompanyRecord => Boolean(record));

      setMemberships(parsed);
      membershipsRef.current = parsed;
      return parsed;
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar empresas del usuario.');
        return membershipsRef.current;
      }
      console.error('Error inesperado al cargar las empresas del usuario.', error);
      return membershipsRef.current;
    } finally {
      setIsLoadingMemberCompanies(false);
    }
  }, [checkConnection, setMemberships, token]);

  const refreshMemberCompanies = useCallback(async () => {
    const latest = await loadMemberCompanies();
    hasRequestedCompanies.current = false;
    return latest;
  }, [loadMemberCompanies]);

  useEffect(() => {
    if (!token) {
      setMemberships([]);
      return;
    }
    void loadMemberCompanies();
  }, [loadMemberCompanies, setMemberships, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const missingCompanies = memberships
      .map(record => record.companyId)
      .filter(companyId => !companies.some(company => company.id === companyId));

    if (missingCompanies.length && !hasRequestedCompanies.current) {
      hasRequestedCompanies.current = true;
      void loadCompanies();
    }
  }, [companies, loadCompanies, memberships, token]);

  const value = useMemo(
    () => ({
      memberships,
      memberCompanies,
      isLoadingMemberCompanies,
      loadMemberCompanies,
      refreshMemberCompanies,
    }),
    [isLoadingMemberCompanies, loadMemberCompanies, memberCompanies, memberships, refreshMemberCompanies],
  );

  return <MemberCompaniesContext.Provider value={value}>{children}</MemberCompaniesContext.Provider>;
};

export const useMemberCompanies = () => useContext(MemberCompaniesContext);
