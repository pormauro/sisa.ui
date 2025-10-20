import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { SecureTextInput } from '@/components/SecureTextInput';
import { RadioGroup } from '@/components/RadioGroup';
import {
  AfipConfigContext,
  AfipConfigForm,
  AfipEnvironment,
} from '@/contexts/AfipConfigContext';
import { useThemeColor } from '@/hooks/useThemeColor';

type FormErrors = Partial<Record<keyof AfipConfigForm, string>>;

const ENVIRONMENT_OPTIONS: { label: string; value: AfipEnvironment }[] = [
  { label: 'Homologación', value: 'homologacion' },
  { label: 'Producción', value: 'produccion' },
];

const formatCuitForDisplay = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 11);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const initialForm: AfipConfigForm = {
  cuit: '',
  certificate: '',
  privateKey: '',
  environment: 'homologacion',
};

export default function AfipSettingsScreen() {
  const { config, loadAfipConfig, updateAfipConfig, isSyncing, lastSyncedAt, lastError } =
    useContext(AfipConfigContext);
  const [form, setForm] = useState<AfipConfigForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#f5f5f5', dark: 'rgba(255,255,255,0.08)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#3f3f46' }, 'background');
  const statusTextColor = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');
  const warningColor = '#d14343';

  useFocusEffect(
    useCallback(() => {
      void loadAfipConfig();
    }, [loadAfipConfig])
  );

  useEffect(() => {
    if (config) {
      setForm({
        cuit: formatCuitForDisplay(config.cuit),
        certificate: config.certificate ?? '',
        privateKey: config.privateKey ?? '',
        environment: (config.environment as AfipEnvironment) ?? 'homologacion',
      });
    }
  }, [config]);

  const formattedLastSync = useMemo(() => {
    if (!lastSyncedAt) {
      return 'Aún no se registran sincronizaciones.';
    }
    const date = new Date(lastSyncedAt);
    if (Number.isNaN(date.getTime())) {
      return lastSyncedAt;
    }
    return date.toLocaleString();
  }, [lastSyncedAt]);

  const validateForm = useCallback(
    (values: AfipConfigForm): FormErrors => {
      const newErrors: FormErrors = {};
      const cuitDigits = values.cuit.replace(/[^0-9]/g, '');
      if (cuitDigits.length !== 11) {
        newErrors.cuit = 'El CUIT debe contener 11 dígitos.';
      }
      if (!values.certificate.trim()) {
        newErrors.certificate = 'Ingresa el contenido del certificado (.crt/.pem).';
      }
      if (!values.privateKey.trim()) {
        newErrors.privateKey = 'Ingresa la clave privada asociada (.key/.pem).';
      }
      return newErrors;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Alert.alert('Revisa los campos obligatorios', 'Completa el formulario para continuar.');
      return;
    }

    const success = await updateAfipConfig({
      ...form,
      cuit: form.cuit.replace(/[^0-9]/g, ''),
    });

    if (success) {
      setErrors({});
      Alert.alert('Configuración AFIP', 'Los datos se actualizaron correctamente.');
    }
  }, [form, updateAfipConfig, validateForm]);

  const handleReload = useCallback(() => {
    void loadAfipConfig();
  }, [loadAfipConfig]);

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.title}>Configuración de AFIP</ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona el certificado digital y la clave privada necesarios para emitir comprobantes desde AFIP.
          </ThemedText>

          <View style={[styles.statusCard, { backgroundColor: cardBackground, borderColor }]}>  
            <ThemedText style={styles.statusTitle}>Estado de sincronización</ThemedText>
            <ThemedText style={[styles.statusText, { color: statusTextColor }]}>Último intento: {formattedLastSync}</ThemedText>
            {isSyncing ? (
              <ThemedText style={[styles.statusText, { color: warningColor }]}>Sincronizando…</ThemedText>
            ) : null}
            {lastError ? (
              <ThemedText style={[styles.statusText, { color: warningColor }]}>Último error: {lastError}</ThemedText>
            ) : (
              <ThemedText style={[styles.statusText, { color: statusTextColor }]}>Último error: Ninguno</ThemedText>
            )}
          </View>

          <View style={styles.formSection}>
            <ThemedTextInput
              label="CUIT"
              value={form.cuit}
              keyboardType="number-pad"
              onChangeText={value => {
                setForm(prev => ({ ...prev, cuit: formatCuitForDisplay(value) }));
                setErrors(prev => ({ ...prev, cuit: undefined }));
              }}
              placeholder="XX-XXXXXXXX-X"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.cuit}
              helperText="Incluye solamente los 11 dígitos. Se formatea automáticamente."
            />

            <ThemedText style={styles.sectionLabel}>Certificado digital</ThemedText>
            <ThemedText style={styles.helperText}>
              Pega el contenido del archivo `.crt` o `.pem` emitido por AFIP.
            </ThemedText>
            <ThemedTextInput
              value={form.certificate}
              onChangeText={value => {
                setForm(prev => ({ ...prev, certificate: value }));
                setErrors(prev => ({ ...prev, certificate: undefined }));
              }}
              placeholder="-----BEGIN CERTIFICATE-----"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={8}
              style={styles.multilineInput}
              error={errors.certificate}
            />

            <ThemedText style={styles.sectionLabel}>Clave privada</ThemedText>
            <ThemedText style={styles.helperText}>
              Copia la clave privada (.key/.pem). Puedes alternar la visibilidad para verificarla antes de guardar.
            </ThemedText>
            <SecureTextInput
              value={form.privateKey}
              onChangeText={value => {
                setForm(prev => ({ ...prev, privateKey: value }));
                setErrors(prev => ({ ...prev, privateKey: undefined }));
              }}
              placeholder="-----BEGIN PRIVATE KEY-----"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={8}
              style={styles.multilineInput}
              error={errors.privateKey}
            />

            <ThemedText style={styles.sectionLabel}>Ambiente</ThemedText>
            <RadioGroup
              options={ENVIRONMENT_OPTIONS}
              value={form.environment}
              onValueChange={value =>
                setForm(prev => ({ ...prev, environment: value as AfipEnvironment }))
              }
              disabled={isSyncing}
            />
          </View>

          <View style={styles.actions}>
            <ThemedButton
              title={isSyncing ? 'Guardando…' : 'Guardar configuración'}
              onPress={handleSubmit}
              disabled={isSyncing}
              style={[styles.actionButton, isSyncing && styles.disabledButton]}
            />
            <ThemedButton
              title={isSyncing ? 'Sincronizando…' : 'Actualizar desde servidor'}
              onPress={handleReload}
              disabled={isSyncing}
              lightColor="transparent"
              darkColor="transparent"
              lightTextColor={statusTextColor}
              darkTextColor={statusTextColor}
              style={[styles.secondaryButton, { borderColor }]}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 24,
    gap: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
  },
  formSection: {
    gap: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
  },
  multilineInput: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 220,
  },
  secondaryButton: {
    minWidth: 220,
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.8,
  },
});
