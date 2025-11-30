import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AuthContext, AUTH_TIMING_CONFIG } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getInitialItems } from '@/utils/auth/secureStore';

type CacheSnapshot = {
  token: string | null;
  user_id: string | null;
  username: string | null;
  password: string | null;
  token_expiration: string | null;
  email: string | null;
};

const formatDateTime = (value: number | null) => {
  if (!value) return 'Pendiente';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatDuration = (ms: number) => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.round(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

const maskValue = (value: string | null) => {
  if (!value) return 'No disponible';
  if (value.length <= 18) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
};

const StatusPill = ({ label, color }: { label: string; color: string }) => (
  <View style={[styles.statusPill, { backgroundColor: color }]}>
    <ThemedText style={styles.statusPillText}>{label}</ThemedText>
  </View>
);

const ProgressBar = ({ progress, color }: { progress: number; color: string }) => {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${normalizedProgress * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const TimerCard = ({
  title,
  description,
  lastRun,
  nextRun,
  durationMs,
  now,
  color,
}: {
  title: string;
  description: string;
  lastRun: number | null;
  nextRun: number | null;
  durationMs: number;
  now: number;
  color: string;
}) => {
  const { progress, remainingLabel } = useMemo(() => {
    if (!lastRun || !nextRun) {
      return { progress: 0, remainingLabel: 'Pendiente de primera ejecución' };
    }
    const total = nextRun - lastRun || durationMs;
    const remaining = Math.max(0, nextRun - now);
    const elapsed = total - remaining;
    return { progress: Math.min(1, Math.max(0, elapsed / total)), remainingLabel: formatDuration(remaining) };
  }, [durationMs, lastRun, nextRun, now]);

  return (
    <ThemedView style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        <ThemedText style={styles.cardSubtitle}>{formatDateTime(lastRun)}</ThemedText>
      </View>
      <ThemedText style={styles.cardDescription}>{description}</ThemedText>
      <View style={styles.progressRow}>
        <ProgressBar progress={progress} color={color} />
        <ThemedText style={styles.progressLabel}>{remainingLabel} para el próximo ciclo</ThemedText>
      </View>
      <ThemedText style={styles.metaText}>Siguiente ejecución: {formatDateTime(nextRun)}</ThemedText>
    </ThemedView>
  );
};

const AuthDiagnosticsScreen = () => {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e2e8f0', dark: '#2b2f3a' }, 'background');
  const mutedColor = useThemeColor({ light: '#4a5568', dark: '#e2e8f0' }, 'text');

  const {
    userId,
    username,
    email,
    token,
    isOffline,
    isLoading,
    tokenExpiration,
    lastTokenValidationAt,
    nextTokenValidationAt,
    lastProfileCheckAt,
    nextProfileCheckAt,
  } = useContext(AuthContext);

  const [now, setNow] = useState<number>(Date.now());
  const [cacheSnapshot, setCacheSnapshot] = useState<CacheSnapshot>({
    token: null,
    user_id: null,
    username: null,
    password: null,
    token_expiration: null,
    email: null,
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userId && userId !== '1') {
      router.replace('/Home');
    }
  }, [router, userId]);

  useEffect(() => {
    const loadCache = async () => {
      const keys = ['token', 'user_id', 'username', 'password', 'token_expiration', 'email'];
      const [cachedToken, cachedUserId, cachedUsername, cachedPassword, cachedExpiration, cachedEmail] =
        await getInitialItems(keys);
      setCacheSnapshot({
        token: cachedToken,
        user_id: cachedUserId,
        username: cachedUsername,
        password: cachedPassword,
        token_expiration: cachedExpiration,
        email: cachedEmail,
      });
    };

    void loadCache();
  }, []);

  const expirationMs = useMemo(() => {
    if (!tokenExpiration) return null;
    const parsed = parseInt(tokenExpiration, 10);
    if (Number.isNaN(parsed)) return null;
    return parsed - now;
  }, [now, tokenExpiration]);

  const tokenStatus = useMemo(() => {
    if (!token) {
      return { label: 'Sin token en RAM', color: '#f97316' };
    }
    if (expirationMs === null) {
      return { label: 'Token sin expiración calculada', color: '#3b82f6' };
    }
    if (expirationMs <= 0) {
      return { label: 'Token expirado', color: '#ef4444' };
    }
    return { label: `Vigente (${formatDuration(expirationMs)})`, color: '#10b981' };
  }, [expirationMs, token]);

  const sourceStatus = useMemo(() => {
    if (isOffline) return { label: 'Sesión restaurada offline', color: '#f59e0b' };
    if (token) return { label: 'Sesión activa online', color: '#0ea5e9' };
    if (cacheSnapshot.token) return { label: 'Solo en caché', color: '#a855f7' };
    return { label: 'Sin sesión vigente', color: '#94a3b8' };
  }, [cacheSnapshot.token, isOffline, token]);

  const cacheConsistency = useMemo(() => {
    const cacheMatchesMemory =
      cacheSnapshot.token === token &&
      cacheSnapshot.user_id === userId &&
      cacheSnapshot.username === username &&
      cacheSnapshot.email === email &&
      cacheSnapshot.token_expiration === tokenExpiration;

    if (cacheMatchesMemory) {
      return 'Caché y memoria alineadas para reanudar sesión incluso si la app se reinicia sin conexión.';
    }

    if (cacheSnapshot.token && !token) {
      return 'La caché conserva la última sesión aunque no esté cargada en memoria (se cargará al validar credenciales).';
    }

    return 'Hay diferencias entre caché y memoria; forzar login refrescará ambos estados.';
  }, [cacheSnapshot.email, cacheSnapshot.token, cacheSnapshot.token_expiration, cacheSnapshot.user_id, cacheSnapshot.username, email, token, tokenExpiration, userId, username]);

  const expirationLabel = useMemo(() => {
    if (expirationMs === null) return 'Sin dato';
    if (expirationMs <= 0) return 'Expirado';
    return `${formatDuration(expirationMs)} restantes`;
  }, [expirationMs]);

  if (userId && userId !== '1') {
    return null;
  }

  const cachedExpirationDate = cacheSnapshot.token_expiration
    ? formatDateTime(parseInt(cacheSnapshot.token_expiration, 10))
    : 'No registrada';

  return (
    <ThemedView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { borderColor: tintColor }]}>
            <Ionicons name="arrow-back" size={20} color={tintColor} />
          </TouchableOpacity>
          <View style={styles.headerTextGroup}>
            <ThemedText style={styles.title}>Panel de token (solo superusuario)</ThemedText>
            <ThemedText style={[styles.subtitle, { color: mutedColor }]}>ID 1 accede sin restricciones.</ThemedText>
          </View>
        </View>

        <ThemedView style={[styles.card, { borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Resumen en vivo</ThemedText>
            <View style={styles.statusRow}>
              <StatusPill label={tokenStatus.label} color={tokenStatus.color} />
              <StatusPill label={sourceStatus.label} color={sourceStatus.color} />
            </View>
          </View>
          <ThemedText style={styles.cardDescription}>
            Esta vista refleja el nuevo flujo: todas las peticiones salvo /login envían Bearer automáticamente y, si expira,
            se vuelve a autenticar con las credenciales guardadas antes de propagar el error.
          </ThemedText>
          <ThemedText style={styles.metaText}>Tiempo restante del token: {expirationLabel}</ThemedText>
          <ThemedText style={styles.metaText}>Última validación de expiración: {formatDateTime(lastTokenValidationAt)}</ThemedText>
          <ThemedText style={styles.metaText}>Último ping de perfil: {formatDateTime(lastProfileCheckAt)}</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.cardTitle}>Estado en memoria</ThemedText>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Usuario</ThemedText>
            <ThemedText style={styles.value}>{username ?? 'No asignado'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>User ID</ThemedText>
            <ThemedText style={styles.value}>{userId ?? 'No asignado'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedText style={styles.value}>{email ?? 'Sin dato'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Token actual</ThemedText>
            <ThemedText style={styles.value}>{maskValue(token)}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Expiración en memoria</ThemedText>
            <ThemedText style={styles.value}>{tokenExpiration ? formatDateTime(parseInt(tokenExpiration, 10)) : 'Sin registrar'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Modo offline</ThemedText>
            <ThemedText style={styles.value}>{isOffline ? 'Activo' : 'Conectado'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Loader inicial</ThemedText>
            <ThemedText style={styles.value}>{isLoading ? 'Verificando sesión' : 'Resuelto'}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={[styles.card, { borderColor }]}> 
          <ThemedText style={styles.cardTitle}>Persistencia en caché</ThemedText>
          <ThemedText style={[styles.cardDescription, { marginBottom: 12 }]}>Todos los valores se conservan en almacenamiento seguro/AsyncStorage para reanudar el contexto aún sin conexión.</ThemedText>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Token cacheado</ThemedText>
            <ThemedText style={styles.value}>{maskValue(cacheSnapshot.token)}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Credenciales cacheadas</ThemedText>
            <ThemedText style={styles.value}>{cacheSnapshot.username ?? 'No guardadas'} / {maskValue(cacheSnapshot.password)}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Expiración cacheada</ThemedText>
            <ThemedText style={styles.value}>{cachedExpirationDate}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Email cacheado</ThemedText>
            <ThemedText style={styles.value}>{cacheSnapshot.email ?? 'Sin dato'}</ThemedText>
          </View>
          <ThemedText style={styles.metaText}>{cacheConsistency}</ThemedText>
        </ThemedView>

        <TimerCard
          title="Validador de expiración (5 min)"
          description="Controla si el token caducó y reloguea automáticamente usando credenciales persistidas."
          lastRun={lastTokenValidationAt}
          nextRun={nextTokenValidationAt}
          durationMs={AUTH_TIMING_CONFIG.TOKEN_VALIDATION_INTERVAL}
          now={now}
          color={tintColor}
        />

        <TimerCard
          title="Ping de perfil (2 min)"
          description="Consulta /user_profile con Bearer para confirmar la sesión y reintentar login si hay 401 u offline."
          lastRun={lastProfileCheckAt}
          nextRun={nextProfileCheckAt}
          durationMs={AUTH_TIMING_CONFIG.PROFILE_CHECK_INTERVAL}
          now={now}
          color={mutedColor}
        />

        <ThemedView style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.cardTitle}>Cobertura del bearer automático</ThemedText>
          <ThemedText style={styles.cardDescription}>
            El guardián de fetch adjunta Authorization: Bearer a toda URL del backend excepto /login y, ante 401/403/419,
            dispara checkConnection para renovar la sesión con las credenciales persistidas antes de devolver la respuesta.
          </ThemedText>
          <ThemedText style={styles.metaText}>
            Si la API está caída, se restaura la última sesión guardada en modo offline para el superusuario y se mantienen los
            datos en caché hasta que vuelva la conectividad.
          </ThemedText>
        </ThemedView>

        <ThemedView style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.cardTitle}>Parámetros activos</ThemedText>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Reintentos de login</ThemedText>
            <ThemedText style={styles.value}>{AUTH_TIMING_CONFIG.MAX_RETRY} intentos cada {AUTH_TIMING_CONFIG.RETRY_DELAY / 1000}s</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Timeout por petición</ThemedText>
            <ThemedText style={styles.value}>{AUTH_TIMING_CONFIG.TIMEOUT_DURATION / 1000}s</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Fallback inicial</ThemedText>
            <ThemedText style={styles.value}>{AUTH_TIMING_CONFIG.STARTUP_FALLBACK_DELAY / 1000}s para salir del loader</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText style={styles.label}>Endpoint de perfil</ThemedText>
            <ThemedText style={styles.value}>{AUTH_TIMING_CONFIG.USER_PROFILE_ENDPOINT}</ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
};

export default AuthDiagnosticsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTextGroup: {
    flex: 1,
    rowGap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  cardDescription: {
    fontSize: 14,
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    opacity: 0.85,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginLeft: 8,
  },
  progressRow: {
    gap: 8,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.8,
  },
});
