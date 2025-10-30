import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

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
}

export interface CompanyMembershipPayload {
  company_id: number;
  user_id: number;
  role: string | null;
  status: string | null;
  notes: string | null;
}

interface CompanyMembershipsContextValue {
  memberships: CompanyMembership[];
  loading: boolean;
  loadCompanyMemberships: () => Promise<void>;
  addCompanyMembership: (payload: CompanyMembershipPayload) => Promise<CompanyMembership | null>;
  updateCompanyMembership: (id: number, payload: CompanyMembershipPayload) => Promise<boolean>;
  deleteCompanyMembership: (id: number) => Promise<boolean>;
}

const defaultContextValue: CompanyMembershipsContextValue = {
  memberships: [],
  loading: false,
  loadCompanyMemberships: async () => {},
  addCompanyMembership: async () => null,
  updateCompanyMembership: async () => false,
  deleteCompanyMembership: async () => false,
};

export const CompanyMembershipsContext =
  createContext<CompanyMembershipsContextValue>(defaultContextValue);

const parseMembership = (raw: any): CompanyMembership | null => {
  if (!raw) {
    return null;
  }

  const ensureNumber = (value: any): number | null => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const id = ensureNumber(raw.id);
  const companyId = ensureNumber(raw.company_id ?? raw.companyId ?? raw.company?.id);
  const userId = ensureNumber(raw.user_id ?? raw.userId ?? raw.user?.id);

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
    if (Array.isArray(value.items)) {
      return value.items;
    }
    return [];
  };

  return resolveArray()
    .map(parseMembership)
    .filter((membership): membership is CompanyMembership => Boolean(membership));
};

const serializePayload = (payload: CompanyMembershipPayload) => ({
  company_id: payload.company_id,
  user_id: payload.user_id,
  role: payload.role,
  status: payload.status,
  notes: payload.notes,
});

export const CompanyMembershipsProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [memberships, setMemberships] = useCachedState<CompanyMembership[]>(
    'company_memberships',
    []
  );
  const [loading, setLoading] = useState(false);

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
      const response = await fetch(`${BASE_URL}/company_memberships`, {
        headers,
      });

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
        const response = await fetch(`${BASE_URL}/company_memberships`, {
          method: 'POST',
          headers,
          body: JSON.stringify(serializePayload(payload)),
        });

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
        const response = await fetch(`${BASE_URL}/company_memberships/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(serializePayload(payload)),
        });

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
        const response = await fetch(`${BASE_URL}/company_memberships/${id}`, {
          method: 'DELETE',
          headers,
        });

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

  const value = useMemo(
    () => ({
      memberships,
      loading,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
    }),
    [
      memberships,
      loading,
      loadCompanyMemberships,
      addCompanyMembership,
      updateCompanyMembership,
      deleteCompanyMembership,
    ]
  );

  return (
    <CompanyMembershipsContext.Provider value={value}>
      {children}
    </CompanyMembershipsContext.Provider>
  );
};

