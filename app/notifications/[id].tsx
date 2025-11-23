import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { NotificationsContext, type NotificationEntry } from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
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
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const paramId = Array.isArray(params.id) ? params.id[0] : params.id;
  const notificationId = useMemo(() => {
    if (!paramId) return null;
    const parsed = Number(paramId);
    return Number.isNaN(parsed) ? null : parsed;
  }, [paramId]);

  const { notifications, refreshNotifications, markAsRead } = useContext(NotificationsContext);
  const { permissions } = useContext(PermissionsContext);
  const [loading, setLoading] = useState(false);
  const [localItem, setLocalItem] = useState<NotificationEntry | undefined>(undefined);

  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({ light: '#ffffff', dark: '#392c4c' }, 'background');
  const borderColor = useThemeColor({ light: '#d8d8d8', dark: '#4b3f5f' }, 'background');
  const mutedText = useThemeColor({ light: '#666666', dark: '#c7c7c7' }, 'text');
  const spinnerColor = useThemeColor({}, 'tint');
  const tintColor = useThemeColor({}, 'tint');

  const canListNotifications =
    permissions.includes('listNotifications') ||
    permissions.includes('markNotificationRead') ||
    permissions.includes('markAllNotificationsRead');
  const canMarkNotification = permissions.includes('markNotificationRead');

  useEffect(() => {
    if (permissions.length === 0) return;
    if (!canListNotifications) {
      Alert.alert('Acceso denegado', 'No tienes permisos para ver notificaciones.');
      router.back();
    }
  }, [canListNotifications, permissions.length, router]);

  useEffect(() => {
    if (notificationId === null) return;
    const match = notifications.find(item => item.id === notificationId);
    setLocalItem(match);
  }, [notificationId, notifications]);

  useEffect(() => {
    if (notificationId === null || !canListNotifications) return;
    setLoading(true);
    void refreshNotifications().finally(() => setLoading(false));
  }, [canListNotifications, notificationId, refreshNotifications]);

  useEffect(() => {
    if (!localItem || localItem.is_read || !canMarkNotification) return;
    void markAsRead(localItem.id).then(success => {
      if (!success) {
        Alert.alert('Error', 'No se pudo marcar la notificación como leída.');
      }
    });
  }, [canMarkNotification, localItem, markAsRead]);

  if (notificationId === null) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor }]}> 
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
          <ThemedText style={styles.title}>Notificación inválida</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedText }]}>El identificador proporcionado no es válido.</ThemedText>
          <ThemedButton title="Volver" onPress={() => router.back()} style={styles.backButton} />
        </View>
      </ThemedView>
    );
  }

  if (loading && !localItem) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor }]}> 
        <View style={styles.loaderContainer}> 
          <ActivityIndicator size="large" color={spinnerColor} />
        </View>
      </ThemedView>
    );
  }

  if (!localItem) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor }]}> 
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
          <ThemedText style={styles.title}>No encontramos la notificación.</ThemedText>
          <ThemedButton title="Recargar" onPress={() => void refreshNotifications()} style={styles.backButton} />
          <ThemedButton title="Volver" onPress={() => router.back()} style={styles.backButton} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
          <View style={styles.headerRow}> 
            <TouchableOpacity style={[styles.backButton, { borderColor: tintColor }]} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={tintColor} />
            </TouchableOpacity>
            <ThemedText style={styles.title}>Detalle de notificación</ThemedText>
          </View>
          <ThemedText style={styles.itemTitle}>{localItem.title || 'Notificación'}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedText }]}>Creada: {formatDateTime(localItem.created_at)}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedText }]}>Estado: {localItem.is_read ? 'Leída' : 'Pendiente'}</ThemedText>
          {localItem.is_read && (
            <ThemedText style={[styles.subtitle, { color: mutedText }]}>Leída el: {formatDateTime(localItem.read_at)}</ThemedText>
          )}

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Contenido</ThemedText>
            <ThemedText style={styles.bodyText}>{localItem.body || 'Sin descripción'}</ThemedText>
          </View>

          {localItem.type ? (
            <View style={styles.metaRow}> 
              <ThemedText style={styles.metaLabel}>Tipo:</ThemedText>
              <ThemedText style={styles.metaValue}>{localItem.type}</ThemedText>
            </View>
          ) : null}

          {localItem.source_table || localItem.source_id ? (
            <View style={styles.metaRow}> 
              <ThemedText style={styles.metaLabel}>Origen:</ThemedText>
              <ThemedText style={styles.metaValue}>
                {localItem.source_table ?? 'N/D'} {localItem.source_id ? `#${localItem.source_id}` : ''}
              </ThemedText>
            </View>
          ) : null}

          {localItem.company_id ? (
            <View style={styles.metaRow}> 
              <ThemedText style={styles.metaLabel}>Empresa:</ThemedText>
              <ThemedText style={styles.metaValue}>#{localItem.company_id}</ThemedText>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <ThemedText style={[styles.subtitle, { color: mutedText }]}>
              Al abrir se marca como leída automáticamente si tienes permisos.
            </ThemedText>
            <ThemedButton title="Recargar" onPress={() => void refreshNotifications('read')} />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default NotificationDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    marginTop: 14,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaLabel: {
    fontWeight: '700',
    marginRight: 4,
  },
  metaValue: {
    flexShrink: 1,
  },
  actionsRow: {
    marginTop: 16,
    gap: 10,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
