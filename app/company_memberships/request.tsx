import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { CompanyMembershipsContext } from '@/contexts/CompanyMembershipsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useThemeColor } from '@/hooks/useThemeColor';

const RequestCompanyMembershipAccessScreen: React.FC = () => {
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { requestMembershipAccess, memberships, normalizeStatus } = useContext(
    CompanyMembershipsContext
  );
  const { userId } = useContext(AuthContext);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#dedede', dark: '#444' }, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const inputBackground = useThemeColor({ light: '#ffffff', dark: '#1d1d1d' }, 'background');
  const inputBorderColor = useThemeColor({ light: '#dedede', dark: '#555' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#9e9e9e', dark: '#aaaaaa' }, 'text');

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [manualCompanyId, setManualCompanyId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (permissions.includes('listCompanyMemberships')) {
      router.replace('/company_memberships');
    }
  }, [permissions, router]);

  useEffect(() => {
    if (!companies.length) {
      void loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  const numericUserId = useMemo(() => {
    if (!userId) {
      return null;
    }
    const parsed = Number(userId);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }, [userId]);

  const hasPendingOrApprovedMembership = useMemo(() => {
    if (numericUserId === null) {
      return false;
    }
    return memberships.some(membership => {
      if (membership.user_id !== numericUserId) {
        return false;
      }
      const status =
        membership.normalized_status ?? normalizeStatus(membership.status ?? null);
      return status === 'pending' || status === 'approved';
    });
  }, [memberships, normalizeStatus, numericUserId]);

  useEffect(() => {
    if (hasPendingOrApprovedMembership) {
      router.replace('/company_memberships');
    }
  }, [hasPendingOrApprovedMembership, router]);

  const companyItems = useMemo(
    () =>
      companies
        .map(company => ({
          label: company.name ?? `Empresa #${company.id}`,
          value: company.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [companies]
  );

  const parseManualCompanyId = useCallback(() => {
    const trimmed = manualCompanyId.trim();
    if (!trimmed.length) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }, [manualCompanyId]);

  const handleSubmit = useCallback(async () => {
    const parsedManualId = parseManualCompanyId();
    const targetCompanyId = selectedCompanyId ?? parsedManualId;

    if (!targetCompanyId) {
      Alert.alert(
        'Datos incompletos',
        'Seleccioná una empresa del listado o ingresá un ID válido para continuar.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const membership = await requestMembershipAccess(targetCompanyId, {
        message: message.trim().length ? message.trim() : null,
      });

      Alert.alert(
        'Solicitud enviada',
        'Notificamos a los administradores de la empresa para que aprueben tu acceso.'
      );

      const normalizedStatus = membership
        ? membership.normalized_status ?? normalizeStatus(membership.status ?? null)
        : null;

      if (normalizedStatus === 'pending' || normalizedStatus === 'approved') {
        router.replace('/company_memberships');
      }
    } catch (error) {
      const status = typeof (error as any)?.status === 'number' ? (error as any).status : null;
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos enviar tu solicitud. Intentá nuevamente más tarde.';

      if (status === 401) {
        Alert.alert('Sesión expirada', 'Iniciá sesión nuevamente para continuar.');
      } else if (status === 422) {
        Alert.alert('Datos inválidos', fallbackMessage);
      } else {
        Alert.alert('Error', fallbackMessage);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    message,
    normalizeStatus,
    parseManualCompanyId,
    requestMembershipAccess,
    router,
    selectedCompanyId,
  ]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.title}>Solicitar acceso a una empresa</ThemedText>
          <ThemedText style={styles.description}>
            {'Para continuar con tus gestiones necesitás que un administrador apruebe tu acceso a una empresa. '}
            {'Seleccioná la empresa correspondiente y enviá tu solicitud desde los canales habilitados por tu organización.'}
          </ThemedText>
          <ThemedText style={styles.hint}>
            Una vez aprobado el acceso, verás automáticamente el módulo de membresías y podrás administrar tus vínculos sin volver a iniciar sesión.
          </ThemedText>
          <View style={styles.formGroup}>
            <ThemedText style={styles.fieldLabel}>Empresa</ThemedText>
            <SearchableSelect
              items={companyItems}
              selectedValue={selectedCompanyId}
              onValueChange={value => {
                if (typeof value === 'number') {
                  setSelectedCompanyId(value);
                } else if (typeof value === 'string') {
                  const parsed = Number(value);
                  setSelectedCompanyId(Number.isFinite(parsed) ? Math.trunc(parsed) : null);
                } else {
                  setSelectedCompanyId(null);
                }
              }}
              placeholder="Seleccioná la empresa a la que necesitás acceder"
            />
            <ThemedText style={styles.helperText}>
              Si no encontrás la empresa en el listado podés ingresar el ID manualmente.
            </ThemedText>
            <TextInput
              value={manualCompanyId}
              onChangeText={setManualCompanyId}
              placeholder="ID o código de la empresa"
              placeholderTextColor={placeholderColor}
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <View style={styles.formGroup}>
            <ThemedText style={styles.fieldLabel}>Mensaje opcional</ThemedText>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Contale al administrador por qué necesitás el acceso"
              placeholderTextColor={placeholderColor}
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: inputBackground,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: tintColor },
              submitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={buttonTextColor} />
            ) : (
              <ThemedText style={[styles.buttonLabel, { color: buttonTextColor }]}>Enviar solicitud</ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => router.push('/Home')}
          >
            <ThemedText style={[styles.buttonLabel, { color: buttonTextColor }]}>
              Volver al menú principal
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RequestCompanyMembershipAccessScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 96,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'justify',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
