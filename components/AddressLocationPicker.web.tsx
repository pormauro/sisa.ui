import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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

const AddressLocationPicker: React.FC<AddressLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  editable = false,
}) => {
  const resolvedLatitude = toNumericCoordinate(latitude);
  const resolvedLongitude = toNumericCoordinate(longitude);
  const hasCoordinate = resolvedLatitude !== null && resolvedLongitude !== null;

  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const errorColor = useThemeColor({ light: '#b91c1c', dark: '#f87171' }, 'text');
  const actionSurface = useThemeColor({ light: '#F5F9FF', dark: '#111827' }, 'background');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <View>
      <View style={[styles.previewWrapper, { borderColor }]}> 
        <View style={styles.webPlaceholder}>
          <Ionicons name="globe-outline" size={20} color={accentColor} />
          <ThemedText style={styles.title}>Mapa no disponible en versión web</ThemedText>
          <ThemedText style={[styles.helpText, { color: mutedText }]}>Usá la app móvil para posicionar el GPS.</ThemedText>
          {hasCoordinate ? (
            <ThemedText style={[styles.coordinates, { color: mutedText }]}>
              {`Lat: ${resolvedLatitude?.toFixed(6)} · Lng: ${resolvedLongitude?.toFixed(6)}`}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {editable && hasCoordinate ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton, { borderColor, backgroundColor: actionSurface }]}
            onPress={handleClear}
            activeOpacity={0.85}
          >
            <Ionicons name="close-circle" size={18} color={errorColor} style={styles.clearIcon} />
            <ThemedText style={[styles.actionButtonText, styles.clearButtonText]}>Quitar punto</ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  previewWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 130,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  webPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 13,
  },
  coordinates: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginLeft: 0,
  },
  clearIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#d32f2f',
  },
});

export default AddressLocationPicker;
