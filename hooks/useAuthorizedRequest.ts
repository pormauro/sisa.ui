import { useCallback, useContext, useMemo } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { useCompanyContext } from '@/contexts/CompanyContext';
import { buildAuthorizedHeaders } from '@/utils/auth/headers';

export const useAuthorizedRequest = (requireCompany = true) => {
  const { token } = useContext(AuthContext);
  const { activeCompany } = useCompanyContext();

  const canRequest = useMemo(
    () => !!token && (!requireCompany || !!activeCompany),
    [activeCompany, requireCompany, token],
  );

  const buildRequestHeaders = useCallback(
    (headersInit?: RequestInit['headers']) => {
      if (!token || (requireCompany && !activeCompany)) {
        return null;
      }

      return buildAuthorizedHeaders(headersInit, token, activeCompany?.id ?? null);
    },
    [activeCompany, requireCompany, token],
  );

  return { buildRequestHeaders, canRequest, activeCompany };
};
