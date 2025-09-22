import React, { useContext } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedButton } from '@/components/ThemedButton';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const NotificationsScreen: React.FC = () => {
  const router = useRouter();
  const {
    settings,
    settingsHydrated,
    permissionStatus,
    isPermissionGranted,
    setAppointmentRemindersEnabled,
    setAppointmentReminderAtTime,
    setAppointmentReminderOneHourBefore,
    requestPermissions,
  } = useContext(NotificationsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#f5f5f5', dark: '#1e1e1e' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const secondaryText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const remindersEnabled = settings.appointmentRemindersEnabled;

  const handleToggleReminders = async (value: boolean) => {
    await setAppointmentRemindersEnabled(value);
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.warn('Unable to open system settings for notifications', error);
      }
    }
  };

  const permissionLabel =
    permissionStatus === 'granted'
      ? 'Permiso otorgado'
      : permissionStatus === 'denied'
      ? 'Permiso denegado'
      : 'Permiso sin solicitar';

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={accentColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Notificaciones</ThemedText>
      </View>

      <ThemedView style={[styles.infoBox, { borderColor: accentColor }]} lightColor="#f9fafb" darkColor="#111827">
        <ThemedText style={styles.infoTitle}>Recordatorios locales</ThemedText>
        <ThemedText style={[styles.infoText, { color: secondaryText }]}>
          Los avisos se programan como notificaciones locales del sistema. En Expo Go (SDK 53) los avisos push remotos no están disponibles, por lo que recomendamos probarlos en un build de desarrollo.
        </ThemedText>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: cardBackground }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <ThemedText style={styles.sectionTitle}>Recordatorios de citas</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: secondaryText }]}>
              Configura cuándo recibir notificaciones para tus citas programadas.
            </ThemedText>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={handleToggleReminders}
            trackColor={{ false: '#9ca3af', true: accentColor }}
            thumbColor={remindersEnabled ? accentColor : '#f4f3f4'}
            ios_backgroundColor="#9ca3af"
            disabled={!settingsHydrated}
          />
        </View>

        <View style={styles.permissionRow}>
          <View style={styles.permissionContent}>
            <ThemedText style={styles.permissionLabel}>Estado de permisos</ThemedText>
            <ThemedText style={[styles.permissionDescription, { color: secondaryText }]}>
              {permissionLabel}
            </ThemedText>
          </View>
          {!isPermissionGranted && (
            <ThemedButton
              title="Solicitar"
              onPress={handleRequestPermission}
              style={styles.permissionButton}
              lightColor="#2563eb"
              darkColor="#2563eb"
              lightTextColor="#ffffff"
              darkTextColor="#ffffff"
            />
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.optionRow}>
          <View style={styles.optionTexts}>
            <ThemedText style={styles.optionTitle}>Al momento de la cita</ThemedText>
            <ThemedText style={[styles.optionSubtitle, { color: secondaryText }]}>
              Recibirás una alerta cuando la cita comience.
            </ThemedText>
          </View>
          <Switch
            value={settings.appointmentReminderAtTime}
            onValueChange={setAppointmentReminderAtTime}
            trackColor={{ false: '#9ca3af', true: accentColor }}
            thumbColor={settings.appointmentReminderAtTime ? accentColor : '#f4f3f4'}
            ios_backgroundColor="#9ca3af"
            disabled={!settingsHydrated || !remindersEnabled}
          />
        </View>

        <View style={styles.optionRow}>
          <View style={styles.optionTexts}>
            <ThemedText style={styles.optionTitle}>Una hora antes</ThemedText>
            <ThemedText style={[styles.optionSubtitle, { color: secondaryText }]}>
              Recibirás un recordatorio 60 minutos antes de la cita.
            </ThemedText>
          </View>
          <Switch
            value={settings.appointmentReminderOneHourBefore}
            onValueChange={setAppointmentReminderOneHourBefore}
            trackColor={{ false: '#9ca3af', true: accentColor }}
            thumbColor={settings.appointmentReminderOneHourBefore ? accentColor : '#f4f3f4'}
            ios_backgroundColor="#9ca3af"
            disabled={!settingsHydrated || !remindersEnabled}
          />
        </View>
      </ThemedView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  optionTexts: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  permissionContent: {
    flex: 1,
    marginRight: 12,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  permissionButton: {
    paddingHorizontal: 16,
  },
});

export default NotificationsScreen;

