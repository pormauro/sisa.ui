import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { CommentsContext, type CommentEntry } from '@/contexts/CommentsContext';
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

const statusLabel = (item: CommentEntry): 'Pendiente' | 'Respondido' =>
  item.status === 'responded' || !!item.response ? 'Respondido' : 'Pendiente';

const CommentsListScreen = () => {
  const router = useRouter();
  const {
    myComments,
    allComments,
    loadMyComments,
    loadAllComments,
    loadingMyComments,
    loadingAllComments,
    listingAvailable,
  } = useContext(CommentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { userId } = useContext(AuthContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBorderColor = useThemeColor({ light: '#e0e0e0', dark: '#4b3f5f' }, 'background');
  const pendingBackground = useThemeColor({ light: '#FFF4E6', dark: '#5b3d2a' }, 'background');
  const respondedBackground = useThemeColor({ light: '#E6F4FF', dark: '#2d465c' }, 'background');
  const pendingTextColor = useThemeColor({ light: '#a24d12', dark: '#ffffff' }, 'text');
  const respondedTextColor = useThemeColor({ light: '#0b60a1', dark: '#ffffff' }, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const sectionBorder = useThemeColor({ light: '#dedede', dark: '#433357' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  const canReview = useMemo(
    () =>
      userId === '1' ||
      permissions.includes('listComments') ||
      permissions.includes('markCommentSeen'),
    [permissions, userId]
  );
  const canSubmit = useMemo(
    () =>
      permissions.includes('addComment') ||
      permissions.includes('listComments') ||
      permissions.includes('addFeedback') ||
      permissions.includes('listFeedbacks') ||
      userId === '1',
    [permissions, userId]
  );

  const [activeTab, setActiveTab] = useState<'mine' | 'all'>(canReview ? 'all' : 'mine');
  const [refreshing, setRefreshing] = useState(false);

  const dataset = useMemo(() => {
    if (!listingAvailable) {
      return [];
    }
    if (canReview && activeTab === 'all') {
      return allComments;
    }
    return myComments;
  }, [activeTab, allComments, canReview, listingAvailable, myComments]);

  useEffect(() => {
    if (!canReview && activeTab === 'all') {
      setActiveTab('mine');
    }
  }, [activeTab, canReview]);

  const isLoading = useMemo(() => {
    if (!listingAvailable) {
      return false;
    }
    if (canReview && activeTab === 'all') {
      return loadingAllComments;
    }
    return loadingMyComments;
  }, [activeTab, canReview, listingAvailable, loadingAllComments, loadingMyComments]);

  const emptyState = useMemo(() => {
    if (!listingAvailable) {
      return {
        title: 'Listado de comentarios no disponible',
        description:
          'El servicio remoto no admite la consulta del historial. Solo es posible registrar nuevos comentarios.',
      };
    }
    if (canReview && activeTab === 'all') {
      return {
        title: 'Sin comentarios recibidos',
        description: 'Todavía no se registraron comentarios para revisar.',
      };
    }
    if (canReview && activeTab === 'mine') {
      return {
        title: 'No enviaste comentarios todavía',
        description: canSubmit
          ? 'Usa el botón "Nuevo comentario" para iniciar una conversación con el equipo administrador.'
          : 'No tenés permisos para enviar comentarios desde esta cuenta.',
      };
    }
    return {
      title: 'No hay comentarios cargados.',
      description: canSubmit
        ? 'Usa el botón "Nuevo comentario" para enviar tus dudas o mejoras.'
        : 'No tenés permisos para cargar comentarios. Contactá al administrador.',
    };
  }, [activeTab, canReview, canSubmit, listingAvailable]);

  const handleRefresh = useCallback(async () => {
    if (!listingAvailable) {
      return;
    }
    setRefreshing(true);
    try {
      if (canReview && activeTab === 'all') {
        await loadAllComments();
      } else {
        await loadMyComments();
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, canReview, listingAvailable, loadAllComments, loadMyComments]);

  useFocusEffect(
    useCallback(() => {
      if (!listingAvailable) {
        return;
      }
      void loadMyComments();
      if (canReview) {
        void loadAllComments();
      }
    }, [canReview, listingAvailable, loadAllComments, loadMyComments])
  );

  const renderItem = useCallback(
    ({ item }: { item: CommentEntry }) => {
      const status = statusLabel(item);
      const isPending = status === 'Pendiente';
      return (
        <TouchableOpacity
          style={[styles.commentCard, { borderColor: cardBorderColor }]}
          onPress={() => router.push(`/comments/${item.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.commentHeader}>
            <ThemedText style={styles.titleText}>{item.title || 'Sin título'}</ThemedText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isPending ? pendingBackground : respondedBackground },
              ]}
            >
              <ThemedText
                style={[styles.statusText, { color: isPending ? pendingTextColor : respondedTextColor }]}
              >
                {status}
              </ThemedText>
            </View>
          </View>
          {canReview ? (
            <ThemedText style={styles.metaText} numberOfLines={1}>
              Enviado por: {item.user_name || `Usuario #${item.user_id}`}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.metaText} numberOfLines={1}>
            Enviado el {formatDateTime(item.created_at)}
          </ThemedText>
          <ThemedText style={styles.preview} numberOfLines={2}>
            {item.response ? `Respuesta: ${item.response}` : item.comment}
          </ThemedText>
        </TouchableOpacity>
      );
    },
    [cardBorderColor, canReview, pendingBackground, pendingTextColor, respondedBackground, respondedTextColor, router]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <ThemedText style={styles.screenTitle}>Comentarios</ThemedText>
        {canSubmit ? (
          <ThemedButton title="Nuevo comentario" onPress={() => router.push('/comments/create')} />
        ) : null}
      </View>

      {canReview ? (
        <View style={[styles.tabSelector, { borderColor: sectionBorder }]}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'all' && { backgroundColor: tintColor },
            ]}
            onPress={() => setActiveTab('all')}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === 'all' ? styles.tabTextActive : undefined,
              ]}
            >
              Todos
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'mine' && { backgroundColor: tintColor },
            ]}
            onPress={() => setActiveTab('mine')}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === 'mine' ? styles.tabTextActive : undefined,
              ]}
            >
              Mis envíos
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading && dataset.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={spinnerColor} />
        </View>
      ) : (
        <FlatList
          data={dataset}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { borderColor: sectionBorder }]}>
              <ThemedText style={styles.emptyTitle}>{emptyState.title}</ThemedText>
              <ThemedText style={styles.emptyDescription}>{emptyState.description}</ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
};

export default CommentsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  commentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    paddingRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 13,
    marginBottom: 4,
  },
  preview: {
    fontSize: 14,
    color: '#5f5f5f',
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
