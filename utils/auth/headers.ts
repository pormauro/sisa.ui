export const buildAuthorizedHeaders = (
  headersInit: RequestInit['headers'] | undefined,
  token: string | null,
  companyId: number | null | undefined,
): RequestInit['headers'] | null => {
  if (!token) {
    return null;
  }

  const companyValue = companyId ? String(companyId) : null;

  if (!headersInit) {
    return {
      Authorization: `Bearer ${token}`,
      ...(companyValue ? { 'X-Company-ID': companyValue } : {}),
    };
  }

  if (headersInit instanceof Headers) {
    const cloned = new Headers(headersInit);
    cloned.set('Authorization', `Bearer ${token}`);
    if (companyValue) {
      cloned.set('X-Company-ID', companyValue);
    }
    return cloned;
  }

  if (Array.isArray(headersInit)) {
    const filtered = headersInit.filter(
      ([key]) => key?.toLowerCase() !== 'authorization' && key?.toLowerCase() !== 'x-company-id',
    );
    return [
      ...filtered,
      ['Authorization', `Bearer ${token}`],
      ...(companyValue ? [['X-Company-ID', companyValue]] : []),
    ] as RequestInit['headers'];
  }

  return {
    ...(headersInit as Record<string, string>),
    Authorization: `Bearer ${token}`,
    ...(companyValue ? { 'X-Company-ID': companyValue } : {}),
  };
};
