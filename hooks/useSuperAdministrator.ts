import { useContext, useMemo } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { ConfigContext } from '@/contexts/ConfigContext';

const SUPER_ADMIN_ROLE_ALIASES = [
  'superadmin',
  'super administrador',
  'super-administrador',
  'super_administrador',
  'super administrator',
] as const;

const isNumericSuperAdmin = (userId: string | null): boolean => {
  if (!userId) {
    return false;
  }

  const numericId = Number(userId);
  if (!Number.isInteger(numericId)) {
    return false;
  }

  return numericId === 1;
};

const roleMatchesSuperAdmin = (role: string | null | undefined): boolean => {
  if (!role) {
    return false;
  }
  const normalized = role.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return SUPER_ADMIN_ROLE_ALIASES.includes(normalized as (typeof SUPER_ADMIN_ROLE_ALIASES)[number]);
};

export const useSuperAdministrator = () => {
  const { userId } = useContext(AuthContext);
  const configContext = useContext(ConfigContext);

  const normalizedUserId = useMemo(() => {
    if (typeof userId !== 'string') {
      return null;
    }
    const trimmed = userId.trim();
    return trimmed.length ? trimmed : null;
  }, [userId]);

  const role = configContext?.configDetails?.role ?? null;

  const isSuperAdministrator = useMemo(() => {
    if (isNumericSuperAdmin(normalizedUserId)) {
      return true;
    }
    if (roleMatchesSuperAdmin(role)) {
      return true;
    }
    return false;
  }, [normalizedUserId, role]);

  return { normalizedUserId, isSuperAdministrator } as const;
};

export default useSuperAdministrator;
