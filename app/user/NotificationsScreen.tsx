import React, { useCallback, useContext } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedButton } from '@/components/ThemedButton';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const NotificationsScreen: React.FC = () => {
  const { preferences, updatePreferences, permissionStatus, requestPermissions, isReady } =
    useContext(NotificationsContext);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#2c2440' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#bdbfc7' }, 'text');

  const permissionGranted = permissionStatus?.granted ?? false;
  const canAskAgain = permissionStatus?.canAskAgain ?? true;

  const handleToggleAtTime = useCallback(
    (value: boolean) => {
      void updatePreferences({ appointmentAtTime: value });
    },
    [updatePreferences]
  );

  const handleToggleOneHour = useCallback(
    (value: boolean) => {
      void updatePreferences({ appointmentOneHourBefore: value });
    },
    [updatePreferences]
  );

  const handleRequestPermission = useCallback(() => {
    void requestPermissions();
  }, [requestPermissions]);

  const handleOpenSettings = useCallback(async () => {
    try {
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
      } else {
        Alert.alert('Configuración no disponible', 'Abre los ajustes del sistema manualmente.');
      }
    } catch (error) {
      console.log('Error abriendo ajustes del sistema', error);
      Alert.alert('Error', 'No se pudieron abrir los ajustes del sistema.');
    }
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: background }]}> 
        <ActivityIndicator size="large" color={accentColor} />
        <ThemedText style={[styles.loadingText, { color: mutedText }]}>Cargando preferencias...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <ThemedText style={styles.title}>Notificaciones</ThemedText>
      <ThemedText style={[styles.subtitle, { color: mutedText }]}> 
        Administra los recordatorios que se envían como notificaciones del sistema para cada cita.
      </ThemedText>

      <ThemedView style={[styles.card, { backgroundColor: cardBackground }]}> 
        <ThemedText style={styles.cardTitle}>Recordatorios de citas</ThemedText>
        <ThemedText style={[styles.cardDescription, { color: mutedText }]}> 
          De forma predeterminada recibirás dos avisos: uno una hora antes y otro al momento exacto de la cita.
        </ThemedText>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <ThemedText style={styles.switchLabel}>Avisar en el momento de la cita</ThemedText>
            <ThemedText style={[styles.switchDescription, { color: mutedText }]}> 
              Se mostrará una notificación justo cuando comience la cita programada.
            </ThemedText>
          </View>
          <Switch
            value={preferences.appointmentAtTime}
            onValueChange={handleToggleAtTime}
            trackColor={{ false: '#9ca3af', true: accentColor }}
            thumbColor={preferences.appointmentAtTime ? accentColor : '#f4f3f4'}
            ios_backgroundColor="#9ca3af"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <ThemedText style={styles.switchLabel}>Avisar una hora antes</ThemedText>
            <ThemedText style={[styles.switchDescription, { color: mutedText }]}> 
              Recibirás un recordatorio adicional 60 minutos antes para prepararte.
            </ThemedText>
          </View>
          <Switch
            value={preferences.appointmentOneHourBefore}
            onValueChange={handleToggleOneHour}
            trackColor={{ false: '#9ca3af', true: accentColor }}
            thumbColor={preferences.appointmentOneHourBefore ? accentColor : '#f4f3f4'}
            ios_backgroundColor="#9ca3af"
          />
        </View>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: cardBackground }]}> 
        <ThemedText style={styles.cardTitle}>Permisos del sistema</ThemedText>
        <ThemedText style={styles.permissionStatus}> 
          Estado actual: {permissionGranted ? 'activadas' : 'desactivadas'}
        </ThemedText>
        {permissionGranted ? (
          <ThemedText style={[styles.cardDescription, { color: mutedText }]}> 
            Las notificaciones están habilitadas. Puedes modificar esta configuración desde el sistema cuando lo necesites.
          </ThemedText>
        ) : (
          <ThemedText style={[styles.cardDescription, { color: mutedText }]}> 
            Necesitas conceder acceso para que la aplicación pueda mostrar recordatorios en tu dispositivo.
          </ThemedText>
        )}

        {permissionGranted ? (
          <ThemedButton
            title="Abrir configuración del sistema"
            onPress={handleOpenSettings}
            style={styles.button}
          />
        ) : (
          <View style={styles.actionsRow}>
            {canAskAgain ? (
              <ThemedButton
                title="Solicitar permiso"
                onPress={handleRequestPermission}
                style={styles.button}
              />
            ) : null}
            <ThemedButton
              title="Abrir configuración"
              onPress={handleOpenSettings}
              style={styles.button}
            />
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    borderRadius: 12,
    padding: 18,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  permissionStatus: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  button: {
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});

export default NotificationsScreen;

