import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
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

let MapView: any = View;
let Marker: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

const AddressLocationPicker: React.FC<AddressLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  editable = false,
}) => {
  const resolvedLatitude = toNumericCoordinate(latitude);
  const resolvedLongitude = toNumericCoordinate(longitude);
  const hasCoordinate = resolvedLatitude !== null && resolvedLongitude !== null;
  const mapRef = useRef<any>(null);

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
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (pickerVisible) {
      setSelectedCoordinate(hasCoordinate ? { latitude: resolvedLatitude!, longitude: resolvedLongitude! } : null);
    }
  }, [pickerVisible, hasCoordinate, resolvedLatitude, resolvedLongitude]);

  useEffect(() => {
    if (!pickerVisible) {
      setLocationError(null);
      setIsRequestingLocation(false);
    }
  }, [pickerVisible]);

  useEffect(() => {
    if (selectedCoordinate) {
      setLocationError(null);
    }
  }, [selectedCoordinate]);

  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const background = useThemeColor({}, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const actionSurface = useThemeColor({ light: '#F5F9FF', dark: '#111827' }, 'background');
  const errorColor = useThemeColor({ light: '#b91c1c', dark: '#f87171' }, 'text');

  const statusBadgeColor = useThemeColor({ light: '#1b5e20', dark: '#2e7d32' }, 'text');

  const handleMapPress = useCallback((event: any) => {
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

  const handleLocateMe = useCallback(async () => {
    try {
      setLocationError(null);
      setIsRequestingLocation(true);
      const existingPermission = await Location.getForegroundPermissionsAsync();
      let status = existingPermission.status;
      if (status !== 'granted') {
        const permissionRequest = await Location.requestForegroundPermissionsAsync();
        status = permissionRequest.status;
      }
      if (status !== 'granted') {
        setLocationError('Necesitamos permiso para acceder al GPS.');
        return;
      }
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };
      setSelectedCoordinate(coords);
      mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 600);
    } catch (error) {
      console.warn('Unable to fetch current location', error);
      setLocationError('No se pudo obtener la ubicación actual.');
    } finally {
      setIsRequestingLocation(false);
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View>
        <View style={[styles.previewWrapper, styles.webFallbackPreview, { borderColor }]}>
          <Ionicons name="map-outline" size={30} color={accentColor} />
          <ThemedText style={styles.webFallbackTitle}>Mapa no disponible en web</ThemedText>
          <ThemedText style={styles.webFallbackSubtitle}>
            {hasCoordinate
              ? `Coordenadas: ${resolvedLatitude!.toFixed(6)}, ${resolvedLongitude!.toFixed(6)}`
              : 'Sin ubicación seleccionada'}
          </ThemedText>
        </View>

        {editable ? (
          <View style={styles.actionsRow}>
            <View
              style={[
                styles.positionButton,
                { borderColor: accentColor, backgroundColor: actionSurface },
              ]}
            >
              <Ionicons name="information-circle-outline" size={20} color={accentColor} />
              <ThemedText style={[styles.positionButtonText, { color: accentColor }]}>Disponible solo en app móvil</ThemedText>
            </View>
            {hasCoordinate ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton, { borderColor }]}
                onPress={handleClear}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle" size={18} color={errorColor} style={styles.clearIcon} />
                <ThemedText style={[styles.actionButtonText, styles.clearButtonText]}>Quitar punto</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

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

        {hasCoordinate ? (
          <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor }]}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <ThemedText style={styles.statusBadgeText}>Posición confirmada</ThemedText>
          </View>
        ) : null}
      </View>

      {editable ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.positionButton,
              { borderColor: accentColor, backgroundColor: actionSurface },
            ]}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={hasCoordinate ? 'pencil' : 'location-outline'}
              size={20}
              color={accentColor}
            />
            <ThemedText
              style={[
                styles.positionButtonText,
                { color: accentColor },
              ]}
            >
              {hasCoordinate ? 'Editar ubicación' : 'Posicionar GPS'}
            </ThemedText>
          </TouchableOpacity>
          {hasCoordinate ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton, { borderColor }]}
              onPress={handleClear}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle" size={18} color={errorColor} style={styles.clearIcon} />
              <ThemedText style={[styles.actionButtonText, styles.clearButtonText]}>Quitar punto</ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: background }]}>
          <ThemedText style={styles.modalTitle}>Seleccioná la ubicación</ThemedText>
          <MapView
            ref={mapRef}
            style={styles.modalMap}
            initialRegion={previewRegion}
            onPress={handleMapPress}
            showsUserLocation
          >
            {selectedCoordinate ? (
              <Marker
                coordinate={selectedCoordinate}
                draggable
                onDragEnd={(event: any) => {
                  const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                  setSelectedCoordinate({ latitude: lat, longitude: lng });
                }}
              />
            ) : null}
          </MapView>
          <View style={styles.locateActions}>
            <TouchableOpacity
              style={[styles.locateButton, { borderColor: accentColor, backgroundColor: actionSurface }]}
              onPress={handleLocateMe}
              disabled={isRequestingLocation}
              activeOpacity={isRequestingLocation ? 1 : 0.85}
            >
              {isRequestingLocation ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Ionicons name="navigate-outline" size={18} color={accentColor} />
              )}
              <ThemedText style={[styles.locateButtonText, { color: accentColor }]}>
                Usar mi ubicación
              </ThemedText>
            </TouchableOpacity>
          </View>
          {locationError ? (
            <ThemedText style={[styles.locationErrorText, { color: errorColor }]}>{locationError}</ThemedText>
          ) : null}
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
    position: 'relative',
  },
  webFallbackPreview: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  webFallbackTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  webFallbackSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
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
  clearIcon: {
    marginRight: 6,
  },
  statusBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1b5e20',
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
  locateActions: {
    marginTop: 12,
  },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  locateButtonText: {
    fontWeight: '600',
  },
  locationErrorText: {
    marginTop: 8,
    fontSize: 13,
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
