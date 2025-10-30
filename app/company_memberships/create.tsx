import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CompanyMembershipsContext } from '@/contexts/CompanyMembershipsContext';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { ProfilesListContext } from '@/contexts/ProfilesListContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateCompanyMembershipPage() {
  const router = useRouter();
  const { addCompanyMembership } = useContext(CompanyMembershipsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { profiles, loadProfiles } = useContext(ProfilesListContext);
  const { permissions } = useContext(PermissionsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#1b1b1b' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = permissions.includes('addCompanyMembership');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear membresías.');
      router.back();
    }
  }, [canCreate, router]);

  useEffect(() => {
    void loadCompanies();
    void loadProfiles();
  }, [loadCompanies, loadProfiles]);

  const companyItems = useMemo(
    () =>
      companies.map(company => ({
        label: company.name,
        value: company.id,
      })),
    [companies]
  );

  const userItems = useMemo(
    () =>
      profiles.map(profile => ({
        label: `${profile.username}${profile.email ? ` · ${profile.email}` : ''}`,
        value: profile.id,
      })),
    [profiles]
  );

  const handleSubmit = async () => {
    if (!companyId) {
      Alert.alert('Datos incompletos', 'Selecciona la empresa que recibirá al usuario.');
      return;
    }
    if (!userId) {
      Alert.alert('Datos incompletos', 'Selecciona el usuario que se unirá a la empresa.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await addCompanyMembership({
        company_id: companyId,
        user_id: userId,
        role: role.trim() || undefined,
        status: status.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (created) {
        Alert.alert('Membresía creada', 'La relación empresa-usuario se creó correctamente.', [
          {
            text: 'Aceptar',
            onPress: () => router.replace('/company_memberships'),
          },
        ]);
        return;
      }

      Alert.alert(
        'No se pudo crear',
        'Revisá la conexión o los datos ingresados e intentá nuevamente.'
      );
    } catch (error) {
      console.error('Error creating company membership:', error);
      Alert.alert('Error', 'Ocurrió un error al crear la membresía.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}> 
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
            <ThemedText style={styles.title}>Nueva membresía de empresa</ThemedText>

            <ThemedText style={styles.label}>Empresa</ThemedText>
            <SearchableSelect
              items={companyItems}
              selectedValue={companyId}
              onValueChange={value => {
                if (value === null || typeof value === 'undefined') {
                  setCompanyId(null);
                  return;
                }
                const nextValue = typeof value === 'number' ? value : Number(value);
                setCompanyId(Number.isFinite(nextValue) ? nextValue : null);
              }}
              placeholder="Selecciona la empresa"
            />

            <ThemedText style={styles.label}>Usuario</ThemedText>
            <SearchableSelect
              items={userItems}
              selectedValue={userId}
              onValueChange={value => {
                if (value === null || typeof value === 'undefined') {
                  setUserId(null);
                  return;
                }
                const nextValue = typeof value === 'number' ? value : Number(value);
                setUserId(Number.isFinite(nextValue) ? nextValue : null);
              }}
              placeholder="Selecciona el usuario"
            />

            <ThemedText style={styles.label}>Rol asignado (opcional)</ThemedText>
            <ThemedTextInput
              placeholder="Ej.: Administrador, Responsable comercial"
              value={role}
              onChangeText={setRole}
              autoCapitalize="sentences"
            />

            <ThemedText style={styles.label}>Estado interno (opcional)</ThemedText>
            <ThemedTextInput
              placeholder="Ej.: Activo, Invitado, Suspendido"
              value={status}
              onChangeText={setStatus}
            />

            <ThemedText style={styles.label}>Notas (opcional)</ThemedText>
            <ThemedTextInput
              placeholder="Contexto adicional o instrucciones para el equipo"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <ThemedButton
              title={submitting ? 'Creando...' : 'Crear membresía'}
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 12,
  },
});

