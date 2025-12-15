import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Switch,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedView } from '@/components/ThemedView';
import { useNetworkLog } from '@/contexts/NetworkLogContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { type NetworkLogEntry } from '@/utils/networkLogger';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'success' | 'error' | 'pending';

type MethodFilter = 'all' | string;

const statusFilterLabel: Record<StatusFilter, string> = {
  all: 'Todos',
  success: 'Exitosos',
  error: 'Errores',
  pending: 'Pendientes',
};

const statusTagColor = (status?: number, error?: string) => {
  if (error) {
    return '#dc2626';
  }
  if (!status) {
    return '#9ca3af';
  }
  if (status >= 200 && status < 300) return '#16a34a';
  if (status >= 400) return '#f97316';
  return '#2563eb';
};

const methodColor = (method: string) => {
  const palette: Record<string, string> = {
    GET: '#2563eb',
    POST: '#7c3aed',
    PUT: '#d97706',
    DELETE: '#dc2626',
    PATCH: '#14b8a6',
  };
  return palette[method.toUpperCase()] ?? '#4b5563';
};

const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('es-AR');
};

const stringifyPayload = (value: unknown) => {
  if (value === undefined) return 'Sin datos disponibles';
  if (value === null) return 'null';
  if (typeof value === 'string') return value || 'Cadena vacía';
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return `No se pudo serializar el contenido: ${String(error)}`;
  }
};

const extractHostname = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
};

const LogCard = ({
  item,
  expanded,
  onToggle,
  borderColor,
}: {
  item: NetworkLogEntry;
  expanded: boolean;
  onToggle: () => void;
  borderColor: string;
}) => {
  const methodBackground = methodColor(item.request.method);
  const statusBackground = statusTagColor(item.status, item.error);
  const subtitleColor = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const mutedBackground = useThemeColor({ light: '#f3f4f6', dark: '#1f2937' }, 'background');
  const [showBearerToken, setShowBearerToken] = useState(false);

  const headersEntries = Object.entries(item.request.headers ?? {});
  const toggleBearer = () => setShowBearerToken(prev => !prev);

  const renderHeaderValue = (key: string, value: string) => {
    const isBearer = /authorization|token/i.test(key) && /^Bearer\s+/i.test(value);
    if (!isBearer) return value;
    if (showBearerToken) return value;
    const bearerLabel = value.replace(/^Bearer\s+/i, '').trim();
    const masked = bearerLabel ? `${'•'.repeat(Math.min(bearerLabel.length, 8))}` : '•••';
    return `Bearer ${masked}`;
  };

  return (
    <TouchableOpacity style={[styles.card, { borderColor }]} onPress={onToggle}>
      <View style={styles.cardHeader}>
        <View style={[styles.pill, { backgroundColor: methodBackground }]}>
          <ThemedText lightColor="#fff" darkColor="#fff" style={styles.pillText}>
            {item.request.method?.toUpperCase() || 'REQ'}
          </ThemedText>
        </View>
        <View style={styles.cardHeaderContent}>
          <ThemedText style={styles.cardTitle}>{item.request.url}</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: subtitleColor }]}>
            {extractHostname(item.request.url)} • {formatDateTime(item.timestamp)}
          </ThemedText>
        </View>
        <View style={[styles.pill, { backgroundColor: statusBackground }]}>
          <ThemedText lightColor="#fff" darkColor="#fff" style={styles.pillText}>
            {item.error ? 'ERR' : item.status ?? 'N/D'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.metaRow}>
        <ThemedText style={styles.metaText}>Duración: {item.duration} ms</ThemedText>
        {item.error ? (
          <ThemedText style={[styles.errorText]}>Error: {item.error}</ThemedText>
        ) : null}
      </View>

      {expanded ? (
        <View style={[styles.expandedContent, { backgroundColor: mutedBackground }]}>
          <View style={styles.detailBlock}>
            <ThemedText style={styles.detailTitle}>Cabeceras</ThemedText>
            {headersEntries.length ? (
              <View style={styles.headersList}>
                {headersEntries.map(([key, value]) => (
                  <View key={key} style={styles.headerRow}>
                    <ThemedText style={styles.headerKey}>{key}:</ThemedText>
                    <ThemedText style={styles.headerValue} selectable>
                      {renderHeaderValue(key, value)}
                    </ThemedText>
                    {/authorization|token/i.test(key) && /^Bearer\s+/i.test(value) ? (
                      <Pressable
                        onPress={toggleBearer}
                        style={styles.headerToggle}
                        accessibilityRole="button"
                        accessibilityLabel={showBearerToken ? 'Ocultar token' : 'Mostrar token'}
                      >
                        <ThemedText style={styles.headerToggleText}>
                          {showBearerToken ? 'Ocultar' : 'Mostrar'}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText style={styles.detailText}>Sin datos disponibles</ThemedText>
            )}
          </View>
          <View style={styles.detailBlock}>
            <ThemedText style={styles.detailTitle}>Cuerpo</ThemedText>
            <ThemedText style={styles.detailText} selectable>{stringifyPayload(item.request.body)}</ThemedText>
          </View>
          <View style={styles.detailBlock}>
            <ThemedText style={styles.detailTitle}>Respuesta</ThemedText>
            <ThemedText style={styles.detailText} selectable>{stringifyPayload(item.response)}</ThemedText>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const NetworkLogsScreen = () => {
  const router = useRouter();
  const { logs, clearLogs, captureEnabled, setCaptureEnabled } = useNetworkLog();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [uriFilter, setUriFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#312e81' }, 'background');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const modalBackdrop = useThemeColor({ light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.6)' }, 'background');
  const modalCard = useThemeColor({ light: '#fff', dark: '#111827' }, 'background');
  const switchThumb = useThemeColor({ light: '#fff', dark: '#e5e7eb' }, 'background');

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp - a.timestamp), [logs]);

  const uniqueMethods = useMemo(() => {
    const methods = new Set<string>();
    sortedLogs.forEach(log => {
      const method = log.request.method?.toUpperCase();
      if (method) {
        methods.add(method);
      }
    });
    return Array.from(methods);
  }, [sortedLogs]);

  const filteredLogs = useMemo(() => {
    return sortedLogs.filter(log => {
      if (statusFilter === 'success' && !(log.status && log.status >= 200 && log.status < 300)) {
        return false;
      }
      if (statusFilter === 'error' && !(log.error || (log.status !== undefined && log.status >= 400))) {
        return false;
      }
      if (statusFilter === 'pending' && log.status !== undefined) {
        return false;
      }
      if (methodFilter !== 'all' && log.request.method?.toUpperCase() !== methodFilter.toUpperCase()) {
        return false;
      }
      if (uriFilter.trim()) {
        const needle = uriFilter.trim().toLowerCase();
        const url = log.request.url?.toLowerCase() ?? '';
        if (!url.includes(needle)) return false;
      }
      return true;
    });
  }, [methodFilter, sortedLogs, statusFilter, uriFilter]);

  const paginatedLogs = useMemo(
    () => filteredLogs.slice(0, PAGE_SIZE * page),
    [filteredLogs, page],
  );

  const hasMore = paginatedLogs.length < filteredLogs.length;

  const toggleExpanded = useCallback(
    (timestamp: number) => {
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(timestamp)) {
          next.delete(timestamp);
        } else {
          next.add(timestamp);
        }
        return next;
      });
    },
    [],
  );

  const resetPagination = useCallback(() => {
    setPage(1);
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      setPage(prev => prev + 1);
    }
  }, [hasMore]);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setConfirmVisible(false);
    setExpanded(new Set());
    setPage(1);
  }, [clearLogs]);

  const renderItem = useCallback(
    ({ item }: { item: NetworkLogEntry }) => (
      <LogCard
        item={item}
        expanded={expanded.has(item.timestamp)}
        onToggle={() => toggleExpanded(item.timestamp)}
        borderColor={borderColor}
      />
    ),
    [borderColor, expanded, toggleExpanded],
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { borderColor: tintColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={tintColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Registro de red</ThemedText>
        <TouchableOpacity
          style={[styles.collapseButton, { borderColor: tintColor }]}
          onPress={() => setHeaderCollapsed(prev => !prev)}
        >
          <Ionicons name={headerCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={tintColor} />
          <ThemedText style={styles.collapseLabel} lightColor={tintColor}>
            {headerCollapsed ? 'Mostrar' : 'Ocultar'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {!headerCollapsed ? (
        <>
          <View style={styles.filtersContainer}>
            <View style={styles.captureRow}>
              <View style={{ flex: 1, rowGap: 2 }}>
                <ThemedText style={styles.captureLabel}>Capturar solicitudes</ThemedText>
                <ThemedText style={styles.captureDescription}>
                  Usa caché y puedes pausar el registro cuando quieras.
                </ThemedText>
              </View>
              <Switch
                value={captureEnabled}
                onValueChange={setCaptureEnabled}
                trackColor={{ false: '#9ca3af', true: tintColor }}
                thumbColor={switchThumb}
              />
            </View>

            <ThemedText style={styles.filterLabel}>Método</ThemedText>
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => {
                  setMethodFilter('all');
                  resetPagination();
                }}
                style={[
                  styles.chip,
                  methodFilter === 'all'
                    ? { backgroundColor: tintColor, borderColor: tintColor }
                    : { borderColor },
                ]}
              >
                <ThemedText lightColor={methodFilter === 'all' ? '#fff' : undefined} style={styles.chipText}>
                  Todos
                </ThemedText>
              </Pressable>
              {uniqueMethods.map(method => (
                <Pressable
                  key={method}
                  onPress={() => {
                    setMethodFilter(method);
                    resetPagination();
                  }}
                  style={[
                    styles.chip,
                    methodFilter === method
                      ? { backgroundColor: tintColor, borderColor: tintColor }
                      : { borderColor },
                  ]}
                >
                  <ThemedText lightColor={methodFilter === method ? '#fff' : undefined} style={styles.chipText}>
                    {method}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.filterLabel}>Estado</ThemedText>
            <View style={styles.filterRow}>
              {(Object.keys(statusFilterLabel) as StatusFilter[]).map(key => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setStatusFilter(key);
                    resetPagination();
                  }}
                  style={[
                    styles.chip,
                    statusFilter === key
                      ? { backgroundColor: tintColor, borderColor: tintColor }
                      : { borderColor },
                  ]}
                >
                  <ThemedText lightColor={statusFilter === key ? '#fff' : undefined} style={styles.chipText}>
                    {statusFilterLabel[key]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.filterLabel}>Filtrar por URL</ThemedText>
            <ThemedTextInput
              placeholder="/api/v1/recurso"
              value={uriFilter}
              onChangeText={text => {
                setUriFilter(text);
                resetPagination();
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.actionsRow}>
            <ThemedButton
              title="Borrar registro"
              onPress={() => setConfirmVisible(true)}
              style={{ flex: 1 }}
              lightColor="#dc2626"
              darkColor="#991b1b"
              lightTextColor="#fff"
              darkTextColor="#fff"
            />
          </View>
        </>
      ) : null}

      <FlatList
        data={paginatedLogs}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        ListEmptyComponent={
          <View style={[styles.emptyState, { borderColor }]}>
            <ThemedText style={styles.emptyTitle}>Sin solicitudes registradas</ThemedText>
            <ThemedText style={styles.emptyDescription}>
              Las peticiones se registrarán automáticamente al usar la aplicación.
            </ThemedText>
          </View>
        }
      />

      <Modal transparent visible={confirmVisible} animationType="fade">
        <Pressable style={[styles.modalOverlay, { backgroundColor: modalBackdrop }]} onPress={() => setConfirmVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: modalCard }]} onPress={event => event.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Borrar registro</ThemedText>
            <ThemedText style={styles.modalText}>
              ¿Quieres eliminar todo el historial de solicitudes registradas?
            </ThemedText>
            <View style={styles.modalActions}>
              <ThemedButton
                title="Cancelar"
                onPress={() => setConfirmVisible(false)}
                style={{ flex: 1 }}
              />
              <ThemedButton
                title="Confirmar"
                onPress={handleClearLogs}
                style={{ flex: 1 }}
                lightColor="#dc2626"
                darkColor="#991b1b"
                lightTextColor="#fff"
                darkTextColor="#fff"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
};

export default NetworkLogsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    columnGap: 10,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 'auto',
    columnGap: 6,
  },
  collapseLabel: {
    fontWeight: '700',
    fontSize: 13,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  filtersContainer: {
    marginBottom: 10,
    rowGap: 6,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingVertical: 6,
  },
  captureLabel: {
    fontWeight: '700',
  },
  captureDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  filterLabel: {
    fontWeight: '600',
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  metaText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
    textAlign: 'right',
  },
  expandedContent: {
    marginTop: 12,
    borderRadius: 10,
    padding: 10,
    rowGap: 10,
  },
  detailBlock: {
    rowGap: 6,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  headersList: {
    rowGap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    columnGap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerKey: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 12,
  },
  headerValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    flexShrink: 1,
  },
  headerToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9ca3af',
  },
  headerToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    rowGap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalText: {
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    columnGap: 12,
  },
});
