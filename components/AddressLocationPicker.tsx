import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
// eslint-disable-next-line import/no-unresolved
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CoordinateValue, toNumericCoordinate } from '@/utils/coordinates';

interface AddressLocationPickerProps {
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
  onChange: (coordinate: { latitude: number; longitude: number } | null) => void;
  editable?: boolean;
}

const DEFAULT_COORDINATE = { latitude: -34.6037, longitude: -58.3816 };
const DEFAULT_DELTA = { latitudeDelta: 0.1, longitudeDelta: 0.1 };

const AddressLocationPicker: React.FC<AddressLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  editable = false,
}) => {
  const resolvedLatitude = toNumericCoordinate(latitude);
  const resolvedLongitude = toNumericCoordinate(longitude);
  const hasCoordinate = resolvedLatitude !== null && resolvedLongitude !== null;

  const previewRegion = useMemo(
    () => ({
      latitude: resolvedLatitude ?? DEFAULT_COORDINATE.latitude,
      longitude: resolvedLongitude ?? DEFAULT_COORDINATE.longitude,
      ...DEFAULT_DELTA,
    }),
    [resolvedLatitude, resolvedLongitude]
  );

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedCoordinate, setSelectedCoordinate] = useState<{ latitude: number; longitude: number } | null>(
    hasCoordinate ? { latitude: resolvedLatitude!, longitude: resolvedLongitude! } : null
  );

  useEffect(() => {
    if (pickerVisible) {
      setSelectedCoordinate(hasCoordinate ? { latitude: resolvedLatitude!, longitude: resolvedLongitude! } : null);
    }
  }, [pickerVisible, hasCoordinate, resolvedLatitude, resolvedLongitude]);

  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const background = useThemeColor({}, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({ light: '#2e7d32', dark: '#66bb6a' }, 'text');
  const actionSurface = useThemeColor({ light: '#F5F9FF', dark: '#111827' }, 'background');

  const handleMapPress = useCallback((event: MapPressEvent) => {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    setSelectedCoordinate({ latitude: lat, longitude: lng });
  }, []);

  const handleConfirm = useCallback(() => {
    onChange(selectedCoordinate);
    setPickerVisible(false);
  }, [onChange, selectedCoordinate]);

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <View>
      <View style={[styles.previewWrapper, { borderColor }]}>
        <MapView
          style={styles.mapPreview}
          pointerEvents="none"
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          initialRegion={previewRegion}
        >
          {hasCoordinate ? (
            <Marker coordinate={{ latitude: resolvedLatitude!, longitude: resolvedLongitude! }} />
          ) : null}
        </MapView>
        {!hasCoordinate ? (
          <View style={styles.emptyOverlay}>
            <ThemedText style={styles.emptyText}>Sin ubicación seleccionada</ThemedText>
          </View>
        ) : null}
      </View>

      {editable ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.positionButton,
              { borderColor: hasCoordinate ? successColor : accentColor, backgroundColor: actionSurface },
            ]}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={hasCoordinate ? 'location' : 'location-outline'}
              size={20}
              color={hasCoordinate ? successColor : accentColor}
            />
            <ThemedText
              style={[
                styles.positionButtonText,
                { color: hasCoordinate ? successColor : accentColor },
              ]}
            >
              {hasCoordinate ? 'Posición confirmada' : 'Posicionar GPS'}
            </ThemedText>
          </TouchableOpacity>
          {hasCoordinate ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton, { borderColor }]}
              onPress={handleClear}
              activeOpacity={0.85}
            >
              <ThemedText style={[styles.actionButtonText, styles.clearButtonText]}>Limpiar</ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: background }]}>
          <ThemedText style={styles.modalTitle}>Seleccioná la ubicación</ThemedText>
          <MapView
            style={styles.modalMap}
            initialRegion={previewRegion}
            onPress={handleMapPress}
            showsUserLocation={Platform.OS !== 'web'}
          >
            {selectedCoordinate ? (
              <Marker
                coordinate={selectedCoordinate}
                draggable
                onDragEnd={event => {
                  const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                  setSelectedCoordinate({ latitude: lat, longitude: lng });
                }}
              />
            ) : null}
          </MapView>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={() => setPickerVisible(false)}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.modalCancelText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirm, { backgroundColor: buttonColor }]}
              onPress={handleConfirm}
              disabled={!selectedCoordinate}
              activeOpacity={selectedCoordinate ? 0.85 : 1}
            >
              <ThemedText style={[styles.modalConfirmText, { color: buttonTextColor }]}>Guardar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  previewWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    marginTop: 8,
  },
  mapPreview: {
    flex: 1,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  emptyText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  positionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  positionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'transparent',
  },
  clearButtonText: {
    color: '#d32f2f',
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalMap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancel: {
    borderColor: '#ccc',
  },
  modalCancelText: {
    fontWeight: '600',
  },
  modalConfirm: {
    borderColor: 'transparent',
  },
  modalConfirmText: {
    fontWeight: '600',
  },
});

export default AddressLocationPicker;
