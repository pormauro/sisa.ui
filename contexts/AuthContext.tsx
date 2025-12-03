import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';
import { BASE_URL } from '@/config/Index';
import { getItem, removeItem, saveItem, getInitialItems } from '@/utils/auth/secureStore';
import { isAuthErrorStatus } from '@/utils/auth/tokenGuard';
import { buildAuthorizedHeaders } from '@/utils/auth/headers';
import { clearAllDataCaches } from '@/utils/cache';

interface AuthContextProps {
  userId: string | null;
  isLoading: boolean;
  username: string | null;
  email: string | null;
  isOffline: boolean;
  token: string | null;
  tokenExpiration: string | null;
  lastTokenValidationAt: number | null;
  nextTokenValidationAt: number | null;
  lastProfileCheckAt: number | null;
  nextProfileCheckAt: number | null;
  login: (loginUsername: string, loginPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  checkConnection: (forceRefresh?: boolean) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextProps>({
  userId: null,
  isLoading: true,
  username: null,
  email: null,
  isOffline: false,
  token: null,
  tokenExpiration: null,
  lastTokenValidationAt: null,
  nextTokenValidationAt: null,
  lastProfileCheckAt: null,
  nextProfileCheckAt: null,
  login: async () => {},
  logout: async () => {},
  checkConnection: async () => null,
});

// Configuración de tiempos y reintentos (ajustables)
export const AUTH_TIMING_CONFIG = {
  MAX_RETRY: 3,
  RETRY_DELAY: 10000, // 10 segundos de espera para reintentar
  TIMEOUT_DURATION: 5000, // 5 segundos de timeout en las peticiones
  USER_PROFILE_ENDPOINT: `${BASE_URL}/user_profile`,
  STARTUP_FALLBACK_DELAY: 3000, // 3 segundos máximo para salir del loader inicial
} as const;

const {
  MAX_RETRY,
  RETRY_DELAY,
  TIMEOUT_DURATION,
  USER_PROFILE_ENDPOINT,
  STARTUP_FALLBACK_DELAY,
} = AUTH_TIMING_CONFIG;

const SKIP_AUTO_LOGIN_KEY = 'skip_auto_login';

const decodeJwtExpiration = (token: string): number | null => {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decodedPayload = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decodedPayload);
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch (error) {
    console.error('Error decoding JWT expiration', error);
    return null;
  }
};

const computeExpirationFromProfile = (profile: any): string => {
  const now = Date.now();

  const rawSessionExpiration =
    profile && typeof profile === 'object' && 'session_expires' in profile
      ? (profile as { session_expires?: string | null }).session_expires ?? null
      : null;

  if (rawSessionExpiration && typeof rawSessionExpiration === 'string') {
    const parsed = new Date(`${rawSessionExpiration}Z`);
    const adjusted = parsed.getTime() - 3 * 60 * 60 * 1000;
    if (!Number.isNaN(adjusted)) {
      return adjusted.toString();
    }
  }

  const embeddedUser =
    profile && typeof profile === 'object' && 'user' in profile
      ? (profile as { user?: any }).user
      : profile;

  const profileExp =
    embeddedUser && typeof embeddedUser === 'object' && 'exp' in embeddedUser
      ? (embeddedUser as { exp?: number | null }).exp ?? null
      : null;

  if (typeof profileExp === 'number' && profileExp > 0) {
    return (profileExp * 1000).toString();
  }

  const jwtExp =
    embeddedUser && typeof embeddedUser === 'object' && 'token' in embeddedUser
      ? decodeJwtExpiration((embeddedUser as { token?: string | null }).token ?? '')
      : null;

  if (jwtExp) {
    return (jwtExp * 1000).toString();
  }

  return (now + 3600 * 1000).toString();
};

// Función auxiliar para hacer fetch con timeout
const fetchWithTimeout = async (resource: string, options: any = {}) => {
  const { timeout = TIMEOUT_DURATION, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...rest, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [tokenExpiration, setTokenExpiration] = useState<string | null>(null);
  const [lastTokenValidationAt, setLastTokenValidationAt] = useState<number | null>(null);
  const [nextTokenValidationAt, setNextTokenValidationAt] = useState<number | null>(null);
  const [lastProfileCheckAt, setLastProfileCheckAt] = useState<number | null>(null);
  const [nextProfileCheckAt, setNextProfileCheckAt] = useState<number | null>(null);

  // Función auxiliar para limpiar las credenciales (usada en logout y login fallido)
  const clearCredentials = async () => {
    await removeItem('token');
    await removeItem('user_id');
    await removeItem('username');
    await removeItem('password');
    await removeItem('token_expiration');
    await removeItem('email');
    await removeItem('activeCompanyId');
    setToken(null);
    setUserId(null);
    setUsername(null);
    setPassword(null);
    setEmail(null);
    setIsOffline(false);
    setTokenExpiration(null);
    setLastTokenValidationAt(null);
    setNextTokenValidationAt(null);
    setLastProfileCheckAt(null);
    setNextProfileCheckAt(null);
  };

  const clearCaches = useCallback(async () => {
    await clearAllDataCaches();
  }, []);

  const restoreTokenFromCache = useCallback(async () => {
    const [storedToken, storedExpiration] = await getInitialItems(['token', 'token_expiration']);

    if (!storedToken || !storedExpiration) {
      return null;
    }

    const expirationTime = parseInt(storedExpiration, 10);
    const now = Date.now();

    if (Number.isNaN(expirationTime) || now >= expirationTime) {
      return null;
    }

    setToken(storedToken);
    setTokenExpiration(storedExpiration);

    return storedToken;
  }, []);

  const restoreOfflineSession = useCallback(
    async (loginUsername: string, loginPassword: string) => {
      const keys = ['token', 'user_id', 'username', 'password', 'token_expiration', 'email'];
      const [storedToken, storedUserId, storedUsername, storedPassword, storedExpiration, storedEmail] =
        await getInitialItems(keys);

      if (
        !storedToken ||
        !storedUserId ||
        !storedUsername ||
        !storedPassword ||
        !storedExpiration
      ) {
        return false;
      }

      const expirationTime = parseInt(storedExpiration, 10);
      const now = new Date().getTime();
      const sameCredentials = storedUsername === loginUsername && storedPassword === loginPassword;

      if (!sameCredentials || Number.isNaN(expirationTime) || now >= expirationTime) {
        return false;
      }

      setToken(storedToken);
      setUserId(storedUserId);
      setUsername(storedUsername);
      setPassword(storedPassword);
      setEmail(storedEmail ?? null);
      setTokenExpiration(storedExpiration ?? null);
      setIsOffline(true);

      return true;
    },
    []
  );

  const performLogin = useCallback(
    async (
      loginUsername: string,
      loginPassword: string,
      retryCount = 0,
    ): Promise<{ token: string } | null> => {
      try {
        // Petición de login con timeout
        const response = await fetchWithTimeout(`${BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginUsername, password: loginPassword }),
          timeout: TIMEOUT_DURATION,
        });

        if (response.ok) {
          let responseData: any = null;
          try {
            responseData = await response.json();
          } catch (parseError) {
            // Ignoramos errores de parseo ya que algunas respuestas pueden no incluir cuerpo JSON
          }

          const authHeader = response.headers.get('Authorization');
          const newToken =
            authHeader && authHeader.startsWith('Bearer ')
              ? authHeader.split(' ')[1]
              : null;

          // Si el token está vacío, se considera que las credenciales fallaron
          if (!newToken) {
            await clearCredentials();
            throw new Error('Credenciales inválidas, por favor intente nuevamente.');
          }

          // Obtenemos el perfil para extraer el email y demás datos
          const profileResponse = await fetchWithTimeout(USER_PROFILE_ENDPOINT, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
            timeout: TIMEOUT_DURATION,
          });

          if (!profileResponse.ok) {
            throw new Error('No se pudo obtener el perfil del usuario');
          }

          const profileData = await profileResponse.json();
          const profile =
            (profileData && typeof profileData === 'object' ? profileData.profile : null) ??
            (profileData && typeof profileData === 'object' ? profileData.user : null) ??
            profileData;

          const embeddedUser =
            profile && typeof profile === 'object' && 'user' in profile
              ? (profile as { user?: any }).user
              : profile;

          const userIdFromProfile =
            embeddedUser && typeof embeddedUser === 'object'
              ? (embeddedUser.user_id ?? embeddedUser.id ?? null)
              : null;

          const userEmail =
            embeddedUser && typeof embeddedUser === 'object' && 'email' in embeddedUser
              ? (embeddedUser as { email?: string }).email ?? null
              : null;

          if (!userIdFromProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
          }

          const normalizedUserId = userIdFromProfile.toString();
          const expirationTime = computeExpirationFromProfile(profileData);

          await saveItem('token', newToken);
          await saveItem('user_id', normalizedUserId);
          await saveItem('username', loginUsername);
          await saveItem('password', loginPassword);
          await saveItem('token_expiration', expirationTime);
          await removeItem(SKIP_AUTO_LOGIN_KEY);

          if (userEmail) {
            await saveItem('email', userEmail);
          } else {
            await removeItem('email');
          }

          setToken(newToken);
          setUserId(normalizedUserId);
          setUsername(loginUsername);
          setPassword(loginPassword);
          setEmail(userEmail ?? null);
          setTokenExpiration(expirationTime);

          // Conexión exitosa, marcar como online
          setIsOffline(false);

          return { token: newToken };
        } else {
          const errorResult = await response.json();
          throw new Error(errorResult.error || 'Error en el login');
        }
      } catch (error: any) {
        // Si es un timeout y aún no se excede el número de reintentos, reintenta después de un retardo
        if (
          (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) &&
          retryCount < MAX_RETRY
        ) {
          setTimeout(() => {
            performLogin(loginUsername, loginPassword, retryCount + 1);
          }, RETRY_DELAY);
          return;
        }
        // Si es un error de red, marcar como offline
        const normalizedMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
          const isNetworkError =
            normalizedMessage.includes('network') || normalizedMessage.includes('fetch');

        if (isNetworkError) {
          setIsOffline(true);
          const restored = await restoreOfflineSession(loginUsername, loginPassword);
          if (restored) {
            Alert.alert(
              'Modo sin conexión',
              'No se pudo conectar con el servidor, se restauró la última sesión guardada para continuar offline.'
            );
            return;
          }
        } else {
          setIsOffline(false);
        }
        const readableMessage = isNetworkError
          ? 'No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.'
          : error.message;
        Alert.alert('Error de Login', readableMessage ?? 'Error en el login');

        return null;
      }
    },
    [restoreOfflineSession]
  );

  const login = useCallback(
    async (loginUsername: string, loginPassword: string) => {
      await performLogin(loginUsername, loginPassword);
    },
    [performLogin]
  );

  const checkTokenValidity = useCallback(async (): Promise<boolean> => {
    const storedExpiration = tokenExpiration ?? (await getItem('token_expiration'));
    const now = new Date().getTime();
    setLastTokenValidationAt(now);
    setNextTokenValidationAt(null);

    if (!storedExpiration) return false;
    const expirationTime = parseInt(storedExpiration, 10);
    if (!tokenExpiration && storedExpiration) {
      setTokenExpiration(storedExpiration);
    }
    return now < expirationTime;
  }, [tokenExpiration]);

  const ensureTokenAvailability = useCallback(async (forceRefresh = false): Promise<string | null> => {
    let activeToken = token ?? (await restoreTokenFromCache());

    const tokenIsValid = forceRefresh ? false : activeToken ? await checkTokenValidity() : false;

    if (!activeToken || !tokenIsValid) {
      if (username && password) {
        const refreshed = await performLogin(username, password);
        activeToken = refreshed?.token ?? null;
      } else {
        await clearCredentials();
      }
    }

    if (!activeToken) {
      setIsOffline(true);
      return null;
    }

    setIsOffline(false);
    return activeToken;
  }, [token, username, password, restoreTokenFromCache, checkTokenValidity, performLogin, clearCredentials]);

  const ensureTokenWithDeadline = useCallback(
    async (reason: string, forceRefresh = false): Promise<string | null> => {
      const deadline = TIMEOUT_DURATION + 5000;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      try {
        const guardedToken = await Promise.race<string | null>([
          ensureTokenAvailability(forceRefresh),
          new Promise<null>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Timeout renovando token (${reason})`));
            }, deadline);
          }),
        ]);

        if (!guardedToken) {
          await clearCredentials();
        }

        return guardedToken;
      } catch (error) {
        console.error('Fallo al intentar renovar el token', error);
        await clearCredentials();
        return null;
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    },
    [clearCredentials, ensureTokenAvailability]
  );

  const ensureTokenHealthAfterTimeout = useCallback(async () => {
    const availableToken = await ensureTokenWithDeadline('reintento tras timeout');

    if (!availableToken) {
      await clearCredentials();
    }
  }, [clearCredentials, ensureTokenWithDeadline]);

  const autoLogin = useCallback(async () => {
    try {
      const keys = [
        'username',
        'password',
        'token',
        'email',
        'user_id',
        'token_expiration',
        SKIP_AUTO_LOGIN_KEY,
      ];
      const [
        storedUsername,
        storedPassword,
        storedToken,
        storedEmail,
        storedUserId,
        storedExpiration,
        skipAutoLogin,
      ] = await getInitialItems(keys);

      const tokenValid = storedToken ? await checkTokenValidity() : false;
      const effectiveToken = tokenValid ? storedToken : null;
      const shouldLogin = Boolean(storedUsername && storedPassword && !effectiveToken);

      setUsername(storedUsername ?? null);
      setPassword(storedPassword ?? null);
      setEmail(storedEmail ?? null);
      setUserId(storedUserId ?? null);
      setToken(effectiveToken);
      setTokenExpiration(storedExpiration ?? null);
      setIsOffline(false);

      if (skipAutoLogin === 'true') {
        setLastTokenValidationAt(null);
        setNextTokenValidationAt(null);
        setLastProfileCheckAt(null);
        setNextProfileCheckAt(null);
      } else if (shouldLogin && storedUsername && storedPassword) {
        await performLogin(storedUsername, storedPassword);
      } else {
        setLastTokenValidationAt(null);
        setNextTokenValidationAt(null);
        setLastProfileCheckAt(null);
        setNextProfileCheckAt(null);
      }
    } catch (error) {
      console.error('Error during auto login', error);
    } finally {
      setIsLoading(false);
    }
  }, [checkTokenValidity, performLogin]);

  // Evita que la app quede indefinidamente en pantalla de carga si el autoLogin se cuelga
  useEffect(() => {
    let isMounted = true;

    const fallbackTimeout = setTimeout(() => {
      (async () => {
        try {
          const existingToken = token ?? (await restoreTokenFromCache());
          const hasValidToken = existingToken ? await checkTokenValidity() : false;

          if (!hasValidToken) {
            await ensureTokenWithDeadline('carga inicial');
          }
        } catch (error) {
          console.error('Error validating token during startup fallback', error);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      })();
    }, STARTUP_FALLBACK_DELAY);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
    };
  }, [checkTokenValidity, ensureTokenWithDeadline, restoreTokenFromCache, token]);

  const logout = useCallback(async () => {
    await clearCaches();
    await saveItem(SKIP_AUTO_LOGIN_KEY, 'true');
    await clearCredentials();
  }, [clearCaches]);

  const checkConnection = useCallback(async (forceRefresh = false): Promise<string | null> => {
    const now = Date.now();
    setLastProfileCheckAt(now);
    setNextProfileCheckAt(null);

    const activeToken = await ensureTokenWithDeadline('checkConnection', forceRefresh);

    if (!activeToken) {
      return null;
    }

    return activeToken;
  }, [ensureTokenWithDeadline]);

  useEffect(() => {
    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
      return;
    }

    let isHandlingAuthError = false;
    let pendingRefresh: Promise<string | null> | null = null;

    type FetchInput = Parameters<typeof fetch>[0];
    const normalizedBaseUrl = BASE_URL.replace(/\/+$/, '').toLowerCase();

    const shouldHandleRequest = (input: FetchInput): boolean => {
      try {
        let targetUrl: string | null = null;

        if (typeof input === 'string') {
          targetUrl = input;
        } else if (typeof input === 'object' && input !== null) {
          const maybeUrl = (input as { url?: string; href?: string }).url ??
            (input as { url?: string; href?: string }).href;
          if (typeof maybeUrl === 'string') {
            targetUrl = maybeUrl;
          }
        }

        if (!targetUrl) {
          return false;
        }

        const normalizedUrl = targetUrl.toLowerCase();

        if (normalizedBaseUrl && !normalizedUrl.startsWith(normalizedBaseUrl)) {
          return false;
        }

        return !normalizedUrl.includes('/login');
      } catch {
        return false;
      }
    };

    const ensureAuthRefresh = async (): Promise<string | null> => {
      if (!pendingRefresh) {
        pendingRefresh = (async () => {
          try {
            isHandlingAuthError = true;
            return await checkConnection(true);
          } catch (refreshError) {
            console.error('Error refreshing auth token', refreshError);
            return null;
          } finally {
            isHandlingAuthError = false;
          }
        })();
      }

      const currentTask = pendingRefresh;
      try {
        if (currentTask) {
          return await currentTask;
        }
      } finally {
        if (pendingRefresh === currentTask) {
          pendingRefresh = null;
        }
      }

      return null;
    };

    const guardedFetch: typeof fetch = async (input, init) => {
      const shouldAttachAuth = shouldHandleRequest(input);
      const activeToken = shouldAttachAuth
        ? await (token ? Promise.resolve(token) : restoreTokenFromCache())
        : token;

      // No bloqueamos nuevas peticiones esperando la renovación del token; si el backend
      // devuelve un 401, el flujo de retry se encargará de refrescarlo sin demoras extra.
      let effectiveInit = init ?? {};

      if (shouldAttachAuth) {
        const enrichedHeaders = buildAuthorizedHeaders(effectiveInit.headers, activeToken);

        if (enrichedHeaders) {
          effectiveInit = { ...effectiveInit, headers: enrichedHeaders };
        }
      }

      let response: Response;

      try {
        response = await originalFetch(input as any, effectiveInit as any);
      } catch (error: any) {
        if (
          shouldAttachAuth &&
          (error?.name === 'AbortError' || `${error?.message ?? ''}`.toLowerCase().includes('timeout'))
        ) {
          await ensureTokenHealthAfterTimeout();
        }
        throw error;
      }

      if (isAuthErrorStatus(response.status) && shouldHandleRequest(input)) {
        const refreshedToken = await ensureAuthRefresh();

        const latestToken = refreshedToken ?? activeToken ?? token;
        const hasStringInput = typeof input === 'string';

        if (latestToken && hasStringInput) {
          const retryHeaders = buildAuthorizedHeaders(init?.headers, latestToken);

          if (!retryHeaders) {
            return response;
          }

          const retryInit: RequestInit = {
            ...(effectiveInit ?? {}),
            headers: retryHeaders,
          };

          const retriedResponse = await originalFetch(input as any, retryInit as any);

          if (!isAuthErrorStatus(retriedResponse.status)) {
            return retriedResponse;
          }

          response = retriedResponse;
        }
      }

      return response;
    };

    globalThis.fetch = guardedFetch as typeof fetch;

    return () => {
      globalThis.fetch = originalFetch as typeof fetch;
    };
  }, [checkConnection, ensureTokenHealthAfterTimeout, restoreTokenFromCache, token]);

  useEffect(() => {
    autoLogin();
  }, [autoLogin]);

  return (
    <AuthContext.Provider
      value={{
        userId,
        isLoading,
        username,
        email,
        isOffline,
        token,
        tokenExpiration,
        lastTokenValidationAt,
        nextTokenValidationAt,
        lastProfileCheckAt,
        nextProfileCheckAt,
        login,
        logout,
        checkConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
