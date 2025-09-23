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

import { CommentsContext } from '@/contexts/CommentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import FileGallery from '@/components/FileGallery';

const MAX_COMMENT_LENGTH = 2000;

const CommentsCreateScreen = () => {
  const router = useRouter();
  const { submitComment } = useContext(CommentsContext);
  const { permissions } = useContext(PermissionsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({ light: '#ffffff', dark: '#392c4c' }, 'background');
  const borderColor = useThemeColor({ light: '#d9d9d9', dark: '#56476c' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#7a7a7a', dark: '#c5c5c5' }, 'text');
  const spinnerColor = useThemeColor({}, 'tint');

  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [fileIdsJson, setFileIdsJson] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () =>
      permissions.includes('addComment') ||
      permissions.includes('listComments') ||
      permissions.includes('addFeedback') ||
      permissions.includes('listFeedbacks') ||
      permissions.length === 0,
    [permissions]
  );

  useEffect(() => {
    if (!canSubmit) {
      Alert.alert('Acceso denegado', 'No tenés permisos para enviar comentarios.');
      router.back();
    }
  }, [canSubmit, router]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedComment = comment.trim();

    if (!trimmedTitle) {
      Alert.alert('Campos incompletos', 'Indicá un título breve para tu comentario.');
      return;
    }

    if (!trimmedComment) {
      Alert.alert('Campos incompletos', 'Escribí el detalle del comentario que querés compartir.');
      return;
    }

    setSubmitting(true);
    const result = await submitComment({
      title: trimmedTitle,
      comment: trimmedComment,
      file_ids: fileIdsJson || null,
    });
    setSubmitting(false);

    if (result) {
      Alert.alert(
        'Comentario enviado',
        'Gracias por tu mensaje. El equipo de administración responderá desde esta misma pantalla.',
        [
          {
            text: 'Aceptar',
            onPress: () => router.replace('/comments'),
          },
        ]
      );
      setTitle('');
      setComment('');
      setFileIdsJson('');
    } else {
      Alert.alert('Error', 'No se pudo enviar el comentario. Volvé a intentarlo en unos minutos.');
    }
  }, [comment, fileIdsJson, router, submitComment, title]);

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <ThemedText style={styles.title}>Nuevo comentario</ThemedText>
          <ThemedText style={styles.description}>
            Contanos qué necesitás, detectaste o querés mejorar. El mensaje llegará al usuario maestro, quien te
            responderá dentro de la aplicación.
          </ThemedText>

          <ThemedText style={styles.label}>Título</ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ejemplo: Necesito reportar un problema con los trabajos"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor, color: inputTextColor }]}
            maxLength={120}
            autoCapitalize="sentences"
            returnKeyType="next"
          />

          <ThemedText style={styles.label}>Comentario</ThemedText>
          <TextInput
            value={comment}
            onChangeText={text => setComment(text.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Detallá el comentario para que podamos ayudarte"
            placeholderTextColor={placeholderColor}
            style={[styles.textArea, { borderColor, color: inputTextColor }]}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <ThemedText style={styles.helperText}>
            {comment.length}/{MAX_COMMENT_LENGTH} caracteres
          </ThemedText>

          <ThemedText style={styles.label}>Archivos adjuntos</ThemedText>
          <FileGallery filesJson={fileIdsJson} onChangeFilesJson={setFileIdsJson} editable />

          <ThemedButton
            title={submitting ? 'Enviando…' : 'Enviar comentario'}
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

export default CommentsCreateScreen;

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
    marginTop: 12,
  },
});
