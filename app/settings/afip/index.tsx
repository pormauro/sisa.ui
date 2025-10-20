import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AfipConfigContext, AfipEnvironment } from '@/contexts/AfipConfigContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { SecureTextInput } from '@/components/SecureTextInput';
import { useThemeColor } from '@/hooks/useThemeColor';
import { RadioGroup } from '@/components/RadioGroup';

interface FormErrors {
  cuit?: string;
  certificate?: string;
  privateKey?: string;
  environment?: string;
}

const HOMOLOGATION_VALUE: AfipEnvironment = 'homologation';
const PRODUCTION_VALUE: AfipEnvironment = 'production';

export default function AfipSettingsScreen() {
  const { config, isSyncing, syncError, lastSyncedAt, updateAfipConfig, loadAfipConfig } =
    useContext(AfipConfigContext);
  const [cuit, setCuit] = useState('');
  const [certificate, setCertificate] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [environment, setEnvironment] = useState<AfipEnvironment>(HOMOLOGATION_VALUE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#f8f8f8', dark: '#1a1a1a' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'background');
  const sectionTitleColor = useThemeColor({}, 'text');
  const subtleText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const dangerText = useThemeColor({ light: '#c0392b', dark: '#ff6b6b' }, 'text');
  const successText = useThemeColor({ light: '#1d8348', dark: '#58d68d' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryButtonColor = useThemeColor({ light: '#ffffff', dark: '#262626' }, 'background');
  const secondaryBorder = useThemeColor({ light: '#c0c0c0', dark: '#3a3a3a' }, 'background');

  const environmentOptions = useMemo(
    () => [
      { label: 'Homologación', value: HOMOLOGATION_VALUE },
      { label: 'Producción', value: PRODUCTION_VALUE },
    ],
    []
  );

  useEffect(() => {
    if (!config || isDirty) {
      return;
    }
    setCuit(config.cuit ?? '');
    setCertificate(config.certificate ?? '');
    setPrivateKey(config.privateKey ?? '');
    setEnvironment((config.environment as AfipEnvironment) ?? HOMOLOGATION_VALUE);
  }, [config, isDirty]);

  useEffect(() => {
    if (!config) {
      return;
    }
    const timeout = setTimeout(() => setStatusMessage(null), 6000);
    return () => clearTimeout(timeout);
  }, [config]);

  const formattedLastSync = useMemo(() => {
    if (!lastSyncedAt) {
      return 'Nunca sincronizado';
    }
    const parsed = new Date(lastSyncedAt);
    if (Number.isNaN(parsed.getTime())) {
      return 'Sin registro de sincronización';
    }
    return parsed.toLocaleString();
  }, [lastSyncedAt]);

  const handleCuitChange = (value: string) => {
    setIsDirty(true);
    setStatusMessage(null);
    const digitsOnly = value.replace(/[^0-9]/g, '');
    setCuit(digitsOnly.slice(0, 11));
  };

  const handleCertificateChange = (value: string) => {
    setIsDirty(true);
    setStatusMessage(null);
    setCertificate(value);
  };

  const handlePrivateKeyChange = (value: string) => {
    setIsDirty(true);
    setStatusMessage(null);
    setPrivateKey(value);
  };

  const handleEnvironmentChange = (value: AfipEnvironment) => {
    setIsDirty(true);
    setStatusMessage(null);
    setEnvironment(value);
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (cuit.length !== 11) {
      nextErrors.cuit = 'El CUIT debe tener 11 dígitos numéricos.';
    }
    if (!certificate.trim()) {
      nextErrors.certificate = 'Carga el contenido del certificado (.crt/.pem).';
    }
    if (!privateKey.trim()) {
      nextErrors.privateKey = 'Carga la clave privada asociada al certificado.';
    }
    if (![HOMOLOGATION_VALUE, PRODUCTION_VALUE].includes(environment)) {
      nextErrors.environment = 'Selecciona un modo de entorno válido.';
    }
    return nextErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const success = await updateAfipConfig({
      cuit,
      certificate,
      privateKey,
      environment,
    });

    if (success) {
      setIsDirty(false);
      setStatusMessage('Configuración AFIP actualizada correctamente.');
      Alert.alert('Éxito', 'La configuración AFIP se actualizó correctamente.');
    }
  };

  const handleReset = () => {
    setErrors({});
    setStatusMessage(null);
    setIsDirty(false);
    if (config) {
      setCuit(config.cuit ?? '');
      setCertificate(config.certificate ?? '');
      setPrivateKey(config.privateKey ?? '');
      setEnvironment((config.environment as AfipEnvironment) ?? HOMOLOGATION_VALUE);
    } else {
      setCuit('');
      setCertificate('');
      setPrivateKey('');
      setEnvironment(HOMOLOGATION_VALUE);
    }
  };

  const handleRefresh = () => {
    setErrors({});
    setStatusMessage(null);
    setIsDirty(false);
    void loadAfipConfig();
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <ThemedView style={[styles.screen, { backgroundColor: screenBackground }]}> 
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: screenBackground }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={[styles.title, { color: sectionTitleColor }]}>Configuración AFIP</ThemedText>
          <ThemedText style={[styles.description, { color: subtleText }]}> 
            Define los certificados y credenciales necesarios para emitir comprobantes electrónicos. Asegúrate de utilizar el modo correspondiente (homologación para pruebas o producción para comprobantes reales).
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: sectionTitleColor }]}>CUIT</ThemedText>
            <ThemedTextInput
              value={cuit}
              onChangeText={handleCuitChange}
              keyboardType="number-pad"
              placeholder="Ingresa el CUIT sin guiones"
              maxLength={11}
              accessibilityLabel="CUIT de la empresa"
            />
            {errors.cuit ? (
              <ThemedText style={[styles.errorText, { color: dangerText }]}>{errors.cuit}</ThemedText>
            ) : (
              <ThemedText style={[styles.helperText, { color: subtleText }]}>El CUIT debe contener 11 dígitos.</ThemedText>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: sectionTitleColor }]}>Certificado digital</ThemedText>
            <ThemedTextInput
              value={certificate}
              onChangeText={handleCertificateChange}
              multiline
              placeholder="Pega el contenido del certificado .crt/.pem"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Certificado digital AFIP"
            />
            {errors.certificate ? (
              <ThemedText style={[styles.errorText, { color: dangerText }]}>
                {errors.certificate}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.helperText, { color: subtleText }]}>Incluye encabezados y pie del archivo (BEGIN/END CERTIFICATE).</ThemedText>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: sectionTitleColor }]}>Clave privada</ThemedText>
            <SecureTextInput
              value={privateKey}
              onChangeText={handlePrivateKeyChange}
              multiline
              placeholder="Pega la clave privada asociada"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Clave privada AFIP"
            />
            {errors.privateKey ? (
              <ThemedText style={[styles.errorText, { color: dangerText }]}>
                {errors.privateKey}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.helperText, { color: subtleText }]}>Mantén esta clave en un entorno seguro. No la compartas.</ThemedText>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: sectionTitleColor }]}>Modo de entorno</ThemedText>
            <RadioGroup
              options={environmentOptions}
              value={environmentOptions.some(option => option.value === environment)
                ? environment
                : HOMOLOGATION_VALUE}
              onValueChange={value => handleEnvironmentChange(value as AfipEnvironment)}
              disabled={isSyncing}
            />
            {errors.environment ? (
              <ThemedText style={[styles.errorText, { color: dangerText }]}>
                {errors.environment}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.helperText, { color: subtleText }]}>Homologación se utiliza para pruebas, producción para comprobantes válidos.</ThemedText>
            )}
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusTexts}>
              <ThemedText style={[styles.statusLabel, { color: subtleText }]}>Última sincronización</ThemedText>
              <ThemedText style={[styles.statusValue, { color: sectionTitleColor }]}>{formattedLastSync}</ThemedText>
              {syncError ? (
                <ThemedText style={[styles.errorText, { color: dangerText }]}>
                  {syncError}
                </ThemedText>
              ) : null}
              {statusMessage ? (
                <ThemedText style={[styles.successText, { color: successText }]}>
                  {statusMessage}
                </ThemedText>
              ) : null}
            </View>
            {isSyncing ? <ActivityIndicator color={buttonColor} style={styles.spinner} /> : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: secondaryBorder, backgroundColor: secondaryButtonColor }]}
              onPress={handleRefresh}
              disabled={isSyncing}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: sectionTitleColor }]}>
                Recargar
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: secondaryBorder, backgroundColor: secondaryButtonColor }]}
              onPress={handleReset}
              disabled={isSyncing}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: sectionTitleColor }]}>
                Restablecer
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: buttonColor, opacity: isSyncing ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color={buttonTextColor} />
            ) : (
              <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Guardar cambios</ThemedText>
            )}
          </TouchableOpacity>

          {hasErrors ? (
            <ThemedText style={[styles.errorSummary, { color: dangerText }]}>
              Revisa los campos marcados para completar la configuración.
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  successText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTexts: {
    flex: 1,
    gap: 4,
  },
  statusLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorSummary: {
    fontSize: 14,
    fontWeight: '500',
  },
});
