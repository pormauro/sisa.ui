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
