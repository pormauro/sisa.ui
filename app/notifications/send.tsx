import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { NotificationsContext, NotificationSeverity } from '@/contexts/NotificationsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

const parseNumber = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberArray = (value: string): number[] =>
  value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(Number.isFinite);

const parsePayload = (value: string): Record<string, unknown> | null => {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { value } as Record<string, unknown>;
  }
};

const severityOptions: NotificationSeverity[] = ['info', 'success', 'warning', 'error'];

const SendNotificationScreen = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { sendNotification } = useContext(NotificationsContext);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [userIdsInput, setUserIdsInput] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity>('info');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceHistoryId, setSourceHistoryId] = useState('');
  const [payload, setPayload] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#40314f' }, 'background');

  const canSend = useMemo(() => userId === '1', [userId]);

  const handleSubmit = useCallback(async () => {
    if (!canSend) {
      Alert.alert('Sin permisos', 'Solo el superusuario puede enviar notificaciones manuales.');
      return;
    }

    if (!title.trim() || !body.trim()) {
      Alert.alert('Datos incompletos', 'Agregá al menos título y cuerpo para enviar la notificación.');
      return;
    }

    const parsedUserId = parseNumber(userIdInput);
    const parsedUserIds = parseNumberArray(userIdsInput);

    if (!parsedUserId && parsedUserIds.length === 0) {
      Alert.alert('Destinatarios faltantes', 'Indicá al menos un usuario en "user_id" o "user_ids".');
      return;
    }

    setSubmitting(true);
    try {
      const { notificationId, invalidUserIds } = await sendNotification({
        title: title.trim(),
        body: body.trim(),
        user_id: parsedUserId,
        user_ids: parsedUserIds.length > 0 ? parsedUserIds : undefined,
        company_id: parseNumber(companyId),
        severity,
        source_table: sourceTable.trim() || null,
        source_id: parseNumber(sourceId),
        source_history_id: parseNumber(sourceHistoryId),
        payload: parsePayload(payload),
        type: 'manual',
      });

      const invalidMessage =
        invalidUserIds.length > 0
          ? ` Usuarios inválidos: ${invalidUserIds.join(', ')}`
          : '';

      Alert.alert(
        notificationId ? 'Notificación enviada' : 'Envío completado',
        `${notificationId ? `ID: ${notificationId}. ` : ''}Se procesó la solicitud.${invalidMessage}`.trim(),
      );

      if (notificationId) {
        router.back();
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    body,
    canSend,
    companyId,
    payload,
    router,
    sendNotification,
    severity,
    sourceHistoryId,
    sourceId,
    sourceTable,
    title,
    userIdInput,
    userIdsInput,
  ]);

  const renderSeverityOptions = () => (
    <View style={styles.severityRow}>
          {severityOptions.map(option => {
            const active = option === severity;
            return (
              <ThemedButton
                key={option}
                title={option.toUpperCase()}
                onPress={() => setSeverity(option)}
                style={[
                  styles.severityButton,
              {
                backgroundColor: active ? tintColor : 'transparent',
                borderColor: tintColor,
                borderWidth: 1,
              },
            ]}
            textStyle={{ color: active ? '#FFFFFF' : tintColor, fontWeight: '700' }}
          />
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor }}>
        <ThemedView style={[styles.container, { borderColor }]}> 
          <ThemedText style={styles.title}>Enviar notificación manual</ThemedText>
          <ThemedText style={styles.subtitle}>
            Solo disponible para el superusuario (id=1). El resto de los usuarios no puede acceder.
          </ThemedText>

          {!canSend && (
            <ThemedText style={styles.warning}>
              No tenés permisos para enviar notificaciones. Iniciá sesión como superusuario para continuar.
            </ThemedText>
          )}

          <ThemedText style={styles.label}>Título *</ThemedText>
          <ThemedTextInput value={title} onChangeText={setTitle} placeholder="Título visible" />

          <ThemedText style={styles.label}>Cuerpo *</ThemedText>
          <ThemedTextInput
            value={body}
            onChangeText={setBody}
            placeholder="Mensaje descriptivo"
            multiline
            style={styles.multiline}
          />

          <ThemedText style={styles.label}>user_id (opcional)</ThemedText>
          <ThemedTextInput
            value={userIdInput}
            onChangeText={setUserIdInput}
            keyboardType="number-pad"
            placeholder="Ej: 2"
          />

          <ThemedText style={styles.label}>user_ids separados por coma (opcional)</ThemedText>
          <ThemedTextInput
            value={userIdsInput}
            onChangeText={setUserIdsInput}
            keyboardType="number-pad"
            placeholder="Ej: 2,3,4"
          />

          <ThemedText style={styles.label}>company_id</ThemedText>
          <ThemedTextInput
            value={companyId}
            onChangeText={setCompanyId}
            keyboardType="number-pad"
            placeholder="Ej: 1"
          />

          <ThemedText style={styles.label}>Severidad</ThemedText>
          {renderSeverityOptions()}

          <ThemedText style={styles.label}>Tabla de origen</ThemedText>
          <ThemedTextInput value={sourceTable} onChangeText={setSourceTable} placeholder="invoices" />

          <ThemedText style={styles.label}>ID de origen</ThemedText>
          <ThemedTextInput
            value={sourceId}
            onChangeText={setSourceId}
            keyboardType="number-pad"
            placeholder="Ej: 120"
          />

          <ThemedText style={styles.label}>ID de historial</ThemedText>
          <ThemedTextInput
            value={sourceHistoryId}
            onChangeText={setSourceHistoryId}
            keyboardType="number-pad"
            placeholder="Ej: 980"
          />

          <ThemedText style={styles.label}>Payload (JSON opcional)</ThemedText>
          <ThemedTextInput
            value={payload}
            onChangeText={setPayload}
            placeholder='{"cta":"/invoices/120"}'
            multiline
            style={styles.multiline}
          />

          <View style={styles.actionsRow}>
            <ThemedButton
              title="Cancelar"
              onPress={() => router.back()}
              style={[styles.actionButton, { backgroundColor: '#6B7280' }]}
              disabled={submitting}
            />
            <ThemedButton
              title={submitting ? 'Enviando…' : 'Enviar'}
              onPress={handleSubmit}
              style={[styles.actionButton, { backgroundColor: tintColor }]}
              disabled={submitting}
            />
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SendNotificationScreen;

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
  },
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  warning: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  label: {
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  multiline: {
    minHeight: 80,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  severityButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
});
