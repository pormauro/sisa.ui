import { Alert } from 'react-native';

/**
 * Error específico para indicar que el token ya no es válido y debe solicitarse nuevamente.
 */
export class TokenExpiredError extends Error {
  constructor(message = 'Token inválido o expirado. Se solicitará uno nuevo.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export const isTokenExpiredError = (error: unknown): error is TokenExpiredError =>
  error instanceof TokenExpiredError;

interface EnsureAuthResponseOptions {
  /**
   * Ejecuta lógica para renovar el token (por ejemplo, llamar a `checkConnection`).
   */
  onUnauthorized?: () => Promise<void> | void;
  /**
   * Evita mostrar el alert cuando es `true`.
   */
  silent?: boolean;
}

export const AUTH_ERROR_STATUS_CODES = [401, 403, 419] as const;
const AUTH_ERROR_STATUSES = new Set<number>(AUTH_ERROR_STATUS_CODES);

export const isAuthErrorStatus = (status: number): boolean => AUTH_ERROR_STATUSES.has(status);

/**
 * Verifica si la respuesta indica un problema de autenticación. En caso afirmativo intenta
 * ejecutar la rutina de renovación del token y lanza un error controlado para que el flujo
 * llamador pueda reaccionar sin romper la ejecución general.
 */
export const ensureAuthResponse = async (
  response: Response,
  { onUnauthorized, silent = true }: EnsureAuthResponseOptions = {}
): Promise<Response> => {
  if (AUTH_ERROR_STATUSES.has(response.status)) {
    if (onUnauthorized) {
      await onUnauthorized();
    }

    if (!silent) {
      Alert.alert(
        'Sesión expirada',
        'El token dejó de ser válido. Se solicitará uno nuevo; volvé a intentar la acción.'
      );
    }

    throw new TokenExpiredError();
  }

  return response;
};

