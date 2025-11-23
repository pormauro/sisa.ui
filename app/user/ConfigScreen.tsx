// app/user/ConfigScreen.tsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, Alert, View, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConfigContext } from '@/contexts/ConfigContext';
import { FileContext } from '@/contexts/FilesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useLog } from '@/contexts/LogContext';
import { clearAllDataCaches } from '@/utils/cache';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';

const ConfigScreen: React.FC = () => {
  const { configDetails, loadConfig, updateConfig } = useContext(ConfigContext)!;
  const { clearLocalFiles } = useContext(FileContext);
  const { overlaySuppressed, setOverlaySuppressed, overlaySettingsHydrated } = useLog();
  const [selectedTheme, setSelectedTheme] = useState<string>('light');
  const { cashBoxes } = useContext(CashBoxesContext);
  const [defaultPaymentCashBox, setDefaultPaymentCashBox] = useState<string>('');
  const [defaultReceivingCashBox, setDefaultReceivingCashBox] = useState<string>('');
  const [showNotificationsBadge, setShowNotificationsBadge] = useState<boolean>(true);

  useEffect(() => {
    // Cargamos la configuración (loadConfig se ejecuta al montar el provider, pero aquí se puede refrescar)
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (configDetails?.theme) {
      setSelectedTheme(configDetails.theme);
    }
    if (configDetails) {
      setDefaultPaymentCashBox(
        configDetails.default_payment_cash_box_id !== null
          ? String(configDetails.default_payment_cash_box_id)
          : ''
      );
      setDefaultReceivingCashBox(
        configDetails.default_receiving_cash_box_id !== null
          ? String(configDetails.default_receiving_cash_box_id)
          : ''
      );
      setShowNotificationsBadge(configDetails.show_notifications_badge);
    }
  }, [configDetails]);

  const handleClearFiles = (): void => {
    Alert.alert('Confirmación', '¿Deseas borrar los datos de los archivos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          void clearLocalFiles();
        },
      },
    ]);
  };

  const handleClearCache = (): void => {
    Alert.alert('Confirmación', '¿Deseas borrar los datos almacenados en caché?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          void clearAllDataCaches();
        },
      },
    ]);
  };

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');

  const cashBoxOptions = useMemo(
    () => [
      { label: 'Sin asignar', value: '' },
      ...cashBoxes.map(cb => ({ label: cb.name, value: cb.id.toString() })),
    ],
    [cashBoxes]
  );

  const normalizeSelectedValue = (value: string | number | null): { stringValue: string; numericValue: number | null } => {
    if (value === null) {
      return { stringValue: '', numericValue: null };
    }

    const stringValue = String(value);
    if (stringValue.length === 0) {
      return { stringValue: '', numericValue: null };
    }

    const parsed = Number(stringValue);
    return {
      stringValue,
      numericValue: Number.isNaN(parsed) ? null : parsed,
    };
  };

  const handleThemeChange = (value: string): void => {
    if (value === selectedTheme) {
      return;
    }
    setSelectedTheme(value);
    if (configDetails) {
      void updateConfig({
        ...configDetails,
        theme: value,
      });
    }
  };

  const handleDefaultPaymentCashBoxChange = (value: string | number | null): void => {
    const { stringValue, numericValue } = normalizeSelectedValue(value);
    setDefaultPaymentCashBox(stringValue);

    if (!configDetails) {
      return;
    }

    if (configDetails.default_payment_cash_box_id === numericValue) {
      return;
    }

    void updateConfig({
      ...configDetails,
      default_payment_cash_box_id: numericValue,
    });
  };

  const handleDefaultReceivingCashBoxChange = (value: string | number | null): void => {
    const { stringValue, numericValue } = normalizeSelectedValue(value);
    setDefaultReceivingCashBox(stringValue);

    if (!configDetails) {
      return;
    }

    if (configDetails.default_receiving_cash_box_id === numericValue) {
      return;
    }

    void updateConfig({
      ...configDetails,
      default_receiving_cash_box_id: numericValue,
    });
  };

  const handleToggleNotificationsBadge = (value: boolean): void => {
    setShowNotificationsBadge(value);

    if (!configDetails || configDetails.show_notifications_badge === value) {
      return;
    }

    void updateConfig({
      ...configDetails,
      show_notifications_badge: value,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ThemedText style={styles.subtitle}>Configuración</ThemedText>
      {configDetails ? (
        <ThemedView style={styles.dataContainer} lightColor="#f5f5f5" darkColor="#1e1e1e">
          <ThemedText style={styles.infoText}>Tema</ThemedText>
          <View style={styles.themeSelector}>
            <TouchableOpacity
              style={[
                styles.themeButton,
                { backgroundColor: inputBackground },
                selectedTheme === 'light' && styles.selectedThemeButton,
              ]}
              onPress={() => handleThemeChange('light')}
            >
              <Ionicons
                name="sunny"
                size={24}
                color={selectedTheme === 'light' ? inputTextColor : '#888'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeButton,
                { backgroundColor: inputBackground },
                selectedTheme === 'dark' && styles.selectedThemeButton,
              ]}
              onPress={() => handleThemeChange('dark')}
            >
              <Ionicons
                name="moon"
                size={24}
                color={selectedTheme === 'dark' ? inputTextColor : '#888'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Ocultar globito de errores</ThemedText>
            <Switch
              value={overlaySuppressed}
              onValueChange={setOverlaySuppressed}
              trackColor={{ false: '#9ca3af', true: accentColor }}
              thumbColor={overlaySuppressed ? accentColor : '#f4f3f4'}
              ios_backgroundColor="#9ca3af"
              disabled={!overlaySettingsHydrated}
            />
          </View>
          <ThemedText style={styles.switchHint}>
            Al activarlo se ocultará el indicador flotante de errores.
          </ThemedText>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Globo de notificaciones</ThemedText>
            <Switch
              value={showNotificationsBadge}
              onValueChange={handleToggleNotificationsBadge}
              trackColor={{ false: '#9ca3af', true: accentColor }}
              thumbColor={showNotificationsBadge ? accentColor : '#f4f3f4'}
              ios_backgroundColor="#9ca3af"
              disabled={!configDetails}
            />
          </View>
          <ThemedText style={styles.switchHint}>
            Muestra u oculta el globo del menú cuando haya notificaciones sin leer.
          </ThemedText>
          <ThemedText style={styles.selectLabel}>Caja por defecto para cobros</ThemedText>
          <SearchableSelect
            items={cashBoxOptions}
            selectedValue={defaultReceivingCashBox}
            onValueChange={handleDefaultReceivingCashBoxChange}
            placeholder="Selecciona una caja"
            style={styles.select}
          />
          <ThemedText style={styles.selectLabel}>Caja por defecto para pagos</ThemedText>
          <SearchableSelect
            items={cashBoxOptions}
            selectedValue={defaultPaymentCashBox}
            onValueChange={handleDefaultPaymentCashBoxChange}
            placeholder="Selecciona una caja"
            style={styles.select}
          />
          <ThemedButton
            title="Borrar datos de archivos"
            lightColor="#d9534f"
            darkColor="#d9534f"
            onPress={handleClearFiles}
            style={styles.editButton}
          />
          <ThemedButton
            title="Borrar datos de la caché"
            lightColor="#d9534f"
            darkColor="#d9534f"
            onPress={handleClearCache}
            style={styles.editButton}
          />
        </ThemedView>
      ) : (
        <ThemedText style={styles.infoText}>Cargando configuración...</ThemedText>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 120 },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dataContainer: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  infoText: { fontSize: 18, marginVertical: 5 },
  themeSelector: { flexDirection: 'row', marginVertical: 8 },
  themeButton: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedThemeButton: {
    borderColor: '#007AFF',
  },
  editButton: { marginTop: 10 },
  selectLabel: {
    fontSize: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  select: {
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  switchLabel: {
    flex: 1,
    fontSize: 16,
    marginRight: 12,
  },
  switchHint: {
    fontSize: 14,
    marginTop: 6,
    opacity: 0.7,
  },
});

export default ConfigScreen;
