import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { getItem, removeItem, saveItem, getInitialItems } from '@/utils/auth/secureStore';
import { isAuthErrorStatus } from '@/utils/auth/tokenGuard';

interface AuthContextProps {
  userId: string | null;
  isLoading: boolean;
  username: string | null;
  email: string | null;
  isOffline: boolean;
  token: string | null;
  login: (loginUsername: string, loginPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps>({
  userId: null,
  isLoading: true,
  username: null,
  email: null,
  isOffline: false,
  token: null,
  login: async () => {},
  logout: async () => {},
  checkConnection: async () => {},
});

// Configuración de tiempos y reintentos (ajustables)
const MAX_RETRY = 3;
const RETRY_DELAY = 10000; // 10 segundos de espera para reintentar
const TIMEOUT_DURATION = 10000; // 10 segundos de timeout en las peticiones
const PROFILE_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutos para revisar el perfil

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

  // Función auxiliar para limpiar las credenciales (usada en logout y login fallido)
  const clearCredentials = async () => {
    await removeItem('token');
    await removeItem('user_id');
    await removeItem('username');
    await removeItem('password');
    await removeItem('token_expiration');
    await removeItem('email');
    setToken(null);
    setUserId(null);
    setUsername(null);
    setPassword(null);
    setEmail(null);
    setIsOffline(false);
  };

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
      setIsOffline(true);

      return true;
    },
    []
  );

  const performLogin = useCallback(
    async (loginUsername: string, loginPassword: string, retryCount = 0) => {
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
          let newToken =
            authHeader && authHeader.startsWith('Bearer ')
              ? authHeader.split(' ')[1]
              : null;

          if (!newToken && responseData) {
            const bodyToken =
              typeof responseData === 'object' && responseData !== null
                ? responseData.token || responseData.access_token || responseData.Authorization || responseData.authorization
                : null;
            if (typeof bodyToken === 'string' && bodyToken.length > 0) {
              newToken = bodyToken.startsWith('Bearer ')
                ? bodyToken.split(' ')[1]
                : bodyToken;
            }
          }

          // Si el token está vacío, se considera que las credenciales fallaron
          if (!newToken) {
            await clearCredentials();
            throw new Error('Credenciales inválidas, por favor intente nuevamente.');
          }

          // Obtenemos el perfil para extraer el email y demás datos
          const profileResponse = await fetchWithTimeout(`${BASE_URL}/profile`, {
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
          const { id, email: userEmail } = profileData.user;
          const nowInArgentina = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
          const expirationTime = (nowInArgentina.getTime() + 3600 * 1000).toString();

          await saveItem('token', newToken);
          await saveItem('user_id', id.toString());
          await saveItem('username', loginUsername);
          await saveItem('password', loginPassword);
          await saveItem('token_expiration', expirationTime);
          await saveItem('email', userEmail);

          setToken(newToken);
          setUserId(id.toString());
          setUsername(loginUsername);
          setPassword(loginPassword);
          setEmail(userEmail);

          // Conexión exitosa, marcar como online
          setIsOffline(false);
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
    const expiration = await getItem('token_expiration');
    if (!expiration) return false;
    const expirationTime = parseInt(expiration, 10);
    const now = new Date().getTime();
    return now < expirationTime;
  }, []);

  const autoLogin = useCallback(async () => {
    try {
      const keys = ['username', 'password', 'token', 'email', 'user_id'];
      const [storedUsername, storedPassword, storedToken, storedEmail, storedUserId] =
        await getInitialItems(keys);

      if (storedUsername) {
        setUsername(storedUsername);
      }
      if (storedPassword) {
        setPassword(storedPassword);
      }
      if (storedEmail) {
        setEmail(storedEmail);
      }
      if (storedUserId) {
        setUserId(storedUserId);
      }
      const tokenValid = storedToken ? await checkTokenValidity() : false;

      if (tokenValid && storedToken) {
        setToken(storedToken);
      }

      if (storedUsername && storedPassword && (!storedToken || !tokenValid)) {
        void performLogin(storedUsername, storedPassword);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkTokenValidity, performLogin]);

  const logout = useCallback(async () => {
    await clearCredentials();
  }, []);

  const checkConnection = useCallback(async () => {
    if (!token) {
      if (username && password) {
        await performLogin(username, password);
      } else {
        setIsOffline(true);
      }
      return;
    }
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_DURATION,
      });

      // Si recibimos 401, el token es inválido o ha expirado, se reintenta el login
      if (response.status === 401) {
        if (username && password) {
          await performLogin(username, password);
        } else {
          setIsOffline(true);
        }
        return;
      }

      if (!response.ok) {
        setIsOffline(true);
      } else {
        setIsOffline(false);
      }
    } catch (error) {
      setIsOffline(true);
    }
  }, [token, username, password, performLogin]);

  useEffect(() => {
    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
      return;
    }

    let isHandlingAuthError = false;
    let pendingRefresh: Promise<void> | null = null;

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

    const ensureAuthRefresh = async () => {
      if (!pendingRefresh) {
        pendingRefresh = (async () => {
          try {
            isHandlingAuthError = true;
            await checkConnection();
          } catch (refreshError) {
            console.error('Error refreshing auth token', refreshError);
          } finally {
            isHandlingAuthError = false;
          }
        })();
      }

      const currentTask = pendingRefresh;
      try {
        if (currentTask) {
          await currentTask;
        }
      } finally {
        if (pendingRefresh === currentTask) {
          pendingRefresh = null;
        }
      }
    };

    const cloneHeadersWithToken = (
      headersInit: RequestInit['headers'] | undefined,
      tokenValue: string
    ): RequestInit['headers'] => {
      const bearerValue = `Bearer ${tokenValue}`;

      if (!headersInit) {
        return { Authorization: bearerValue };
      }

      if (headersInit instanceof Headers) {
        const cloned = new Headers(headersInit);
        cloned.set('Authorization', bearerValue);
        return cloned;
      }

      if (Array.isArray(headersInit)) {
        const filtered = headersInit.filter(([key]) => key?.toLowerCase() !== 'authorization');
        return [...filtered, ['Authorization', bearerValue]] as RequestInit['headers'];
      }

      return { ...(headersInit as Record<string, string>), Authorization: bearerValue };
    };

    const guardedFetch: typeof fetch = async (input, init) => {
      let response = await originalFetch(input as any, init as any);

      if (isAuthErrorStatus(response.status) && shouldHandleRequest(input)) {
        await ensureAuthRefresh();

        const latestToken = await getItem('token');
        const hasStringInput = typeof input === 'string';

        if (latestToken && hasStringInput) {
          const retryInit: RequestInit = {
            ...(init ?? {}),
            headers: cloneHeadersWithToken(init?.headers, latestToken),
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
  }, [checkConnection]);

  useEffect(() => {
    autoLogin();
  }, [autoLogin]);

  // Chequeo periódico de la validez del token cada 5 minutos
  useEffect(() => {
    const interval = setInterval(async () => {
      const valid = await checkTokenValidity();
      if (!valid && username && password) {
        await performLogin(username, password);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkTokenValidity, performLogin, username, password]);

  // Chequeo periódico del perfil cada 2 minutos para confirmar que sigue logueado
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkConnection();
      // Si no está online y hay credenciales almacenadas, se reintenta el login automáticamente
      if (isOffline && username && password) {
        await performLogin(username, password);
      }
    }, PROFILE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkConnection, isOffline, username, password, performLogin]);

  return (
    <AuthContext.Provider
      value={{
        userId,
        isLoading,
        username,
        email,
        isOffline,
        token,
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
