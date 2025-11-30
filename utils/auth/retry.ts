import { isTokenExpiredError } from './tokenGuard';

interface RetryOptions {
  onUnauthorized?: () => Promise<void> | void;
  retries?: number;
}

export const retryOnTokenExpiration = async <T>(
  operation: () => Promise<T>,
  { onUnauthorized, retries = 1 }: RetryOptions = {}
): Promise<T> => {
  let attempt = 0;

  // Intentamos ejecutar la operación original una vez y, si encontramos un error de token
  // expirado, permitimos reintentar tras ejecutar la rutina de renovación.
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = isTokenExpiredError(error) && attempt < retries;
      if (!shouldRetry) {
        throw error;
      }

      attempt += 1;
      if (onUnauthorized) {
        await onUnauthorized();
      }
    }
  }
};
