import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLog } from '@/contexts/LogContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 16;
const TAP_THRESHOLD = 5;

const typeLabels = {
  error: 'Error',
  warn: 'Advertencia',
  alert: 'Alerta',
} as const;

const typeColors = {
  error: '#dc2626',
  warn: '#f59e0b',
  alert: '#2563eb',
} as const;

const clampPosition = (x: number, y: number) => {
  const { width, height } = Dimensions.get('window');
  const minX = EDGE_MARGIN;
  const minY = EDGE_MARGIN;
  const maxX = width - BUTTON_SIZE - EDGE_MARGIN;
  const maxY = height - BUTTON_SIZE - EDGE_MARGIN;

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
};

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString();

export const LogOverlay: React.FC = () => {
  const { logs, clearLogs, overlaySuppressed, overlaySettingsHydrated } = useLog();
  const [isVisible, setIsVisible] = useState(false);
  const { width, height } = Dimensions.get('window');
  const initialPosition = clampPosition(
    width - BUTTON_SIZE - EDGE_MARGIN,
    height - BUTTON_SIZE - EDGE_MARGIN * 4
  );
  const [position, setPosition] = useState(initialPosition);
  const offset = useRef(position);
  const movedDuringGesture = useRef(false);

  const buttonColor = useThemeColor({}, 'tint');
  const buttonBorderColor = useThemeColor(
    { light: 'rgba(255,255,255,0.95)', dark: 'rgba(255,255,255,0.75)' },
    'background'
  );
  const buttonShadowColor = useThemeColor(
    { light: 'rgba(59,130,246,0.35)', dark: 'rgba(15,23,42,0.6)' },
    'tint'
  );
  const textColor = useThemeColor({}, 'text');
  const modalBackground = useThemeColor({ light: '#ffffff', dark: '#1f2937' }, 'background');
  const secondaryText = useThemeColor(
    { light: 'rgba(31, 41, 55, 0.7)', dark: 'rgba(243, 244, 246, 0.7)' },
    'text'
  );

  const overlayEnabled = !overlaySuppressed;

  useEffect(() => {
    if (!overlayEnabled && isVisible) {
      setIsVisible(false);
    }
  }, [overlayEnabled, isVisible]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.timestamp - a.timestamp),
    [logs]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          movedDuringGesture.current = false;
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextPosition = clampPosition(
            offset.current.x + gestureState.dx,
            offset.current.y + gestureState.dy
          );
          if (
            !movedDuringGesture.current &&
            (Math.abs(gestureState.dx) > TAP_THRESHOLD ||
              Math.abs(gestureState.dy) > TAP_THRESHOLD)
          ) {
            movedDuringGesture.current = true;
          }
          setPosition(nextPosition);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const nextPosition = clampPosition(
            offset.current.x + gestureState.dx,
            offset.current.y + gestureState.dy
          );
          offset.current = nextPosition;
          setPosition(nextPosition);

          if (!movedDuringGesture.current) {
            setIsVisible(true);
          }
        },
      }),
    []
  );

  const handleClearLogs = () => {
    clearLogs();
  };

  const handleCloseModal = () => {
    setIsVisible(false);
  };

  if (!overlaySettingsHydrated || !overlayEnabled) {
    return null;
  }

  const hasLogs = logs.length > 0;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {hasLogs && (
        <View
          style={[
            styles.floatingButton,
            {
              backgroundColor: buttonColor,
              borderColor: buttonBorderColor,
              shadowColor: buttonShadowColor,
              borderWidth: 2,
              left: position.x,
              top: position.y,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Abrir registros de eventos"
          accessibilityHint="Toca para revisar los mensajes ocultos"
          {...panResponder.panHandlers}
        >
          <Ionicons name="alert-circle" size={28} color="#ffffff" />
          {hasLogs && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {logs.length > 99 ? '99+' : logs.length}
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={isVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cerrar registros"
            accessibilityHint="Toca fuera del panel para cerrarlo"
            onPress={handleCloseModal}
          />
          <View style={[styles.modalContent, { backgroundColor: modalBackground }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Registros de eventos</Text>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleClearLogs}
                  disabled={sortedLogs.length === 0}
                  style={({ pressed }) => [
                    styles.headerButton,
                    pressed && sortedLogs.length !== 0 && styles.headerButtonPressed,
                    sortedLogs.length === 0 && styles.headerButtonDisabled,
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color={textColor} />
                  <Text style={[styles.headerButtonText, { color: textColor }]}>Limpiar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCloseModal}
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={22} color={textColor} />
                </Pressable>
              </View>
            </View>

            {sortedLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color={secondaryText} />
                <Text style={[styles.emptyText, { color: secondaryText }]}>Sin registros por mostrar</Text>
              </View>
            ) : (
              <FlatList
                data={sortedLogs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.logRow}>
                    <View
                      style={[styles.typeBadge, { backgroundColor: typeColors[item.type] }]}
                    >
                      <Text style={styles.typeBadgeText}>{typeLabels[item.type]}</Text>
                    </View>
                    <View style={styles.logDetails}>
                      <Text style={[styles.timestamp, { color: secondaryText }]}>
                        {formatTimestamp(item.timestamp)}
                      </Text>
                      <Text style={[styles.message, { color: textColor }]}>{item.message}</Text>
                    </View>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.3)',
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerIconButton: {
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.3)',
  },
  headerButtonPressed: {
    opacity: 0.6,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  logRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  typeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logDetails: {
    flex: 1,
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
});
