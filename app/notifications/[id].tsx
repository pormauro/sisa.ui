import React, { useCallback, useContext, useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { NotificationsContext } from '@/contexts/NotificationsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('es-AR');
};

const NotificationDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const numericId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const { notifications, markNotificationRead } = useContext(NotificationsContext);

  const notification = useMemo(() => notifications.find((item) => item.id === numericId), [notifications, numericId]);
  const actionReference = notification?.action_reference;

  const cardBorderColor = useThemeColor({ light: '#e0e0e0', dark: '#4b3f5f' }, 'background');
  const mutedTextColor = useThemeColor({ light: '#6b6b6b', dark: '#d1c4e9' }, 'text');

  const handleToggleRead = useCallback(() => {
    if (!notification) {
      return;
    }
    void markNotificationRead(notification.id, { read: !notification.is_read });
  }, [markNotificationRead, notification]);

  const handleOpenAction = useCallback(() => {
    if (actionReference) {
      void Linking.openURL(actionReference);
    }
  }, [actionReference]);

  const metadataEntries = useMemo(() => {
    if (!notification?.metadata) {
      return [];
    }
    return Object.entries(notification.metadata).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }));
  }, [notification]);

  if (!notification) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Notificación</ThemedText>
          <ThemedButton title="Volver" onPress={() => router.back()} />
        </View>
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyTitle}>No encontramos esta notificación</ThemedText>
          <ThemedText style={[styles.emptyDescription, { color: mutedTextColor }]}>Regresá al listado y actualizalo para sincronizar los datos más recientes.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Notificación</ThemedText>
        <ThemedButton title="Volver" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { borderColor: cardBorderColor }]}>
          <ThemedText style={styles.cardTitle}>{notification.title || 'Sin título'}</ThemedText>
          <ThemedText style={[styles.meta, { color: mutedTextColor }]}>Evento: {notification.event_key}</ThemedText>
          <ThemedText style={[styles.meta, { color: mutedTextColor }]}>Estado: {notification.is_read ? 'Leída' : 'No leída'}</ThemedText>
          <ThemedText style={[styles.meta, { color: mutedTextColor }]}>Enviada: {formatDateTime(notification.sent_at || notification.created_at)}</ThemedText>
          <ThemedText style={[styles.meta, { color: mutedTextColor }]}>Leída: {notification.is_read ? formatDateTime(notification.read_at) : 'Sin leer'}</ThemedText>
          <ThemedText style={styles.body}>{notification.body || 'Sin contenido'}</ThemedText>
        </View>

        {metadataEntries.length > 0 ? (
          <View style={[styles.card, { borderColor: cardBorderColor }]}>
            <ThemedText style={styles.cardTitle}>Metadata</ThemedText>
            {metadataEntries.map((entry) => (
              <View key={entry.key} style={styles.metadataRow}>
                <ThemedText style={styles.metaLabel}>{entry.key}</ThemedText>
                <ThemedText style={[styles.metaValue, { color: mutedTextColor }]}>{entry.value}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {notification.metadata_raw ? (
          <View style={[styles.card, { borderColor: cardBorderColor }]}>
            <ThemedText style={styles.cardTitle}>Metadata cruda</ThemedText>
            <ThemedText style={[styles.metaValue, { color: mutedTextColor }]} selectable>
              {notification.metadata_raw}
            </ThemedText>
          </View>
        ) : null}

        {notification.delivery_error ? (
          <View style={[styles.card, { borderColor: cardBorderColor }]}>
            <ThemedText style={styles.cardTitle}>Errores de entrega</ThemedText>
            <ThemedText style={[styles.metaValue, { color: '#d32f2f' }]}>{notification.delivery_error}</ThemedText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <ThemedButton
            title={notification.is_read ? 'Marcar como no leída' : 'Marcar como leída'}
            onPress={handleToggleRead}
          />
          {notification.action_reference ? (
            <ThemedButton title="Abrir acción" onPress={handleOpenAction} />
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    fontSize: 16,
    marginTop: 12,
  },
  metadataRow: {
    marginBottom: 8,
  },
  metaLabel: {
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyDescription: {
    textAlign: 'center',
    fontSize: 16,
  },
});

export default NotificationDetailScreen;
