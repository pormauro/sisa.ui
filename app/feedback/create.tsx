import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { FeedbackContext } from '@/contexts/FeedbackContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

const MAX_MESSAGE_LENGTH = 2000;

const FeedbackCreateScreen = () => {
  const router = useRouter();
  const { submitFeedback } = useContext(FeedbackContext);
  const { permissions } = useContext(PermissionsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({ light: '#ffffff', dark: '#392c4c' }, 'background');
  const borderColor = useThemeColor({ light: '#d9d9d9', dark: '#56476c' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#7a7a7a', dark: '#c5c5c5' }, 'text');
  const spinnerColor = useThemeColor({}, 'tint');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => permissions.includes('addFeedback') || permissions.includes('listFeedbacks') || permissions.length === 0,
    [permissions]
  );

  useEffect(() => {
    if (!canSubmit) {
      Alert.alert('Acceso denegado', 'No tenés permisos para enviar feedback.');
      router.back();
    }
  }, [canSubmit, router]);

  const handleSubmit = useCallback(async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      Alert.alert('Campos incompletos', 'Indicá un asunto breve para tu mensaje.');
      return;
    }

    if (!trimmedMessage) {
      Alert.alert('Campos incompletos', 'Escribí el detalle del feedback que querés compartir.');
      return;
    }

    setSubmitting(true);
    const result = await submitFeedback({ subject: trimmedSubject, message: trimmedMessage });
    setSubmitting(false);

    if (result) {
      Alert.alert(
        'Feedback enviado',
        'Gracias por tu mensaje. El equipo de administración responderá desde esta misma pantalla.',
        [
          {
            text: 'Aceptar',
            onPress: () => router.replace('/feedback'),
          },
        ]
      );
      setSubject('');
      setMessage('');
    } else {
      Alert.alert('Error', 'No se pudo enviar el feedback. Volvé a intentarlo en unos minutos.');
    }
  }, [message, router, subject, submitFeedback]);

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
          <ThemedText style={styles.title}>Nuevo feedback</ThemedText>
          <ThemedText style={styles.description}>
            Contanos qué necesitás, detectaste o querés mejorar. El mensaje llegará al usuario maestro, quien te
            responderá dentro de la aplicación.
          </ThemedText>

          <ThemedText style={styles.label}>Asunto</ThemedText>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Ejemplo: Necesito reportar un problema con los trabajos"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor, color: inputTextColor }]}
            maxLength={120}
            autoCapitalize="sentences"
            returnKeyType="next"
          />

          <ThemedText style={styles.label}>Mensaje</ThemedText>
          <TextInput
            value={message}
            onChangeText={text => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Detallá el feedback para que podamos ayudarte"
            placeholderTextColor={placeholderColor}
            style={[styles.textArea, { borderColor, color: inputTextColor }]}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <ThemedText style={styles.helperText}>
            {message.length}/{MAX_MESSAGE_LENGTH} caracteres
          </ThemedText>

          <ThemedButton
            title={submitting ? 'Enviando…' : 'Enviar feedback'}
            onPress={handleSubmit}
            style={styles.submitButton}
            textStyle={styles.submitButtonText}
            disabled={submitting}
          />
          {submitting ? <ActivityIndicator style={styles.spinner} color={spinnerColor} /> : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default FeedbackCreateScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 160,
    marginBottom: 8,
  },
  helperText: {
    alignSelf: 'flex-end',
    fontSize: 12,
    marginBottom: 20,
  },
  submitButton: {
    borderRadius: 10,
    paddingVertical: 14,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  spinner: {
    marginTop: 16,
  },
});
