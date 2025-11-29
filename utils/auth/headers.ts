export const buildAuthorizedHeaders = (
  headersInit: RequestInit['headers'] | undefined,
  token: string | null,
): RequestInit['headers'] | null => {
  if (!token) {
    return null;
  }

  if (!headersInit) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  if (headersInit instanceof Headers) {
    const cloned = new Headers(headersInit);
    cloned.set('Authorization', `Bearer ${token}`);
    return cloned;
  }

  if (Array.isArray(headersInit)) {
    const filtered = headersInit.filter(
      ([key]) => key?.toLowerCase() !== 'authorization',
    );
    return [
      ...filtered,
      ['Authorization', `Bearer ${token}`],
    ] as RequestInit['headers'];
  }

  return {
    ...(headersInit as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
};
