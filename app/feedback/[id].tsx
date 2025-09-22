import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { FeedbackContext } from '@/contexts/FeedbackContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { AuthContext } from '@/contexts/AuthContext';
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

const FeedbackDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const paramId = Array.isArray(params.id) ? params.id[0] : params.id;
  const feedbackId = useMemo(() => {
    if (!paramId) return null;
    const parsed = Number(paramId);
    return Number.isNaN(parsed) ? null : parsed;
  }, [paramId]);

  const {
    myFeedbacks,
    allFeedbacks,
    loadMyFeedbacks,
    loadAllFeedbacks,
    respondFeedback,
    loadingMyFeedbacks,
    loadingAllFeedbacks,
  } = useContext(FeedbackContext);
  const { permissions } = useContext(PermissionsContext);
  const { userId } = useContext(AuthContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({ light: '#ffffff', dark: '#392c4c' }, 'background');
  const borderColor = useThemeColor({ light: '#d8d8d8', dark: '#4b3f5f' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#c7c7c7' }, 'text');
  const spinnerColor = useThemeColor({}, 'tint');
  const badgePendingColor = useThemeColor({ light: '#FFF4E6', dark: '#5b3d2a' }, 'background');
  const badgeRespondedColor = useThemeColor({ light: '#E6F4FF', dark: '#2d465c' }, 'background');
  const badgePendingText = useThemeColor({ light: '#a24d12', dark: '#ffffff' }, 'text');
  const badgeRespondedText = useThemeColor({ light: '#0b60a1', dark: '#ffffff' }, 'text');

  const canRespond = useMemo(
    () => userId === '1' || permissions.includes('respondFeedback'),
    [permissions, userId]
  );

  const feedback = useMemo(() => {
    if (feedbackId === null) return undefined;
    return (
      allFeedbacks.find(item => item.id === feedbackId) ??
      myFeedbacks.find(item => item.id === feedbackId)
    );
  }, [allFeedbacks, feedbackId, myFeedbacks]);

  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setResponseText(feedback?.response_message ?? '');
  }, [feedback?.response_message]);

  useFocusEffect(
    useCallback(() => {
      void loadMyFeedbacks();
      if (canRespond) {
        void loadAllFeedbacks();
      }
    }, [canRespond, loadAllFeedbacks, loadMyFeedbacks])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (canRespond) {
        await Promise.all([loadMyFeedbacks(), loadAllFeedbacks()]);
      } else {
        await loadMyFeedbacks();
      }
    } finally {
      setRefreshing(false);
    }
  }, [canRespond, loadAllFeedbacks, loadMyFeedbacks]);

  const handleRespond = useCallback(async () => {
    if (!feedback) {
      return;
    }
    const trimmed = responseText.trim();
    if (!trimmed) {
      Alert.alert('Respuesta incompleta', 'Escribí un mensaje antes de responder.');
      return;
    }
    setResponding(true);
    const ok = await respondFeedback(feedback.id, trimmed);
    setResponding(false);
    if (ok) {
      Alert.alert('Respuesta enviada', 'El usuario verá la actualización apenas inicie sesión.');
      await handleRefresh();
    } else {
      Alert.alert('Error', 'No se pudo registrar la respuesta. Intentá nuevamente.');
    }
  }, [feedback, handleRefresh, respondFeedback, responseText]);

  const statusLabel = feedback?.response_message ? 'Respondido' : 'Pendiente';
  const globalLoading = loadingMyFeedbacks || (canRespond && loadingAllFeedbacks);
  const isInitialLoading = !feedback && globalLoading;

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {feedbackId === null ? (
          <View style={[styles.emptyCard, { borderColor }]}> 
            <ThemedText style={styles.emptyTitle}>El feedback solicitado no es válido.</ThemedText>
            <ThemedButton title="Volver" onPress={() => router.back()} style={styles.backButton} />
          </View>
        ) : feedback ? (
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
            <View style={styles.headerRow}>
              <ThemedText style={styles.subject}>{feedback.subject || 'Sin asunto'}</ThemedText>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      statusLabel === 'Respondido' ? badgeRespondedColor : badgePendingColor,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusText,
                    { color: statusLabel === 'Respondido' ? badgeRespondedText : badgePendingText },
                  ]}
                >
                  {statusLabel}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.meta}>
              Enviado por: {feedback.user_name || `Usuario #${feedback.user_id}`}
            </ThemedText>
            <ThemedText style={styles.meta}>Fecha: {formatDateTime(feedback.created_at)}</ThemedText>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Mensaje</ThemedText>
              <ThemedText style={styles.bodyText}>{feedback.message}</ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Respuesta</ThemedText>
              {feedback.response_message ? (
                <>
                  {feedback.responded_by_name ? (
                    <ThemedText style={styles.meta}>
                      Respondido por: {feedback.responded_by_name}
                    </ThemedText>
                  ) : null}
                  {feedback.responded_at ? (
                    <ThemedText style={styles.meta}>
                      Fecha: {formatDateTime(feedback.responded_at)}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.bodyText}>{feedback.response_message}</ThemedText>
                </>
              ) : (
                <ThemedText style={styles.pendingHint}>
                  Aún no se registró una respuesta para este feedback.
                </ThemedText>
              )}
            </View>

            {canRespond ? (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Responder o actualizar</ThemedText>
                <TextInput
                  value={responseText}
                  onChangeText={setResponseText}
                  placeholder="Escribí la respuesta que verá el usuario"
                  placeholderTextColor={placeholderColor}
                  style={[styles.textArea, { borderColor, color: inputTextColor }]}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!responding}
                />
                <ThemedButton
                  title={responding ? 'Guardando…' : 'Enviar respuesta'}
                  onPress={handleRespond}
                  style={styles.respondButton}
                  textStyle={styles.respondButtonText}
                  disabled={responding}
                />
              </View>
            ) : null}
          </View>
        ) : isInitialLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={spinnerColor} />
          </View>
        ) : (
          <View style={[styles.emptyCard, { borderColor }]}> 
            <ThemedText style={styles.emptyTitle}>No encontramos este feedback.</ThemedText>
            <ThemedButton title="Volver" onPress={() => router.back()} style={styles.backButton} />
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

export default FeedbackDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subject: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    marginBottom: 6,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  pendingHint: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6c6c6c',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 140,
    marginBottom: 12,
  },
  respondButton: {
    borderRadius: 10,
    paddingVertical: 14,
  },
  respondButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    width: '60%',
  },
});
