import { useContext, useMemo } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export const useCompanyAdminPrivileges = () => {
  const { userId } = useContext(AuthContext);
  const { isCompanyAdmin } = useContext(PermissionsContext);

  const normalizedUserId = useMemo(() => {
    const parsed = Number(userId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [userId]);

  const hasPrivilegedAccess = useMemo(
    () => Boolean(isCompanyAdmin || normalizedUserId === 1),
    [isCompanyAdmin, normalizedUserId]
  );

  return { hasPrivilegedAccess };
};

export default useCompanyAdminPrivileges;
