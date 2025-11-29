import { useCallback, useContext, useMemo } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { buildAuthorizedHeaders } from '@/utils/auth/headers';

export const useAuthorizedRequest = () => {
  const { token } = useContext(AuthContext);

  const canRequest = useMemo(() => !!token, [token]);

  const buildRequestHeaders = useCallback(
    (headersInit?: RequestInit['headers']) => {
      if (!token) {
        return null;
      }

      return buildAuthorizedHeaders(headersInit, token);
    },
    [token],
  );

  return { buildRequestHeaders, canRequest };
};
