import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  CompanyMembershipsContext,
  CompanyMembership,
} from '@/contexts/CompanyMembershipsContext';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { ProfilesListContext } from '@/contexts/ProfilesListContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function EditCompanyMembershipPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const membershipId = useMemo(() => Number(id), [id]);

  const {
    memberships,
    loadCompanyMemberships,
    updateCompanyMembership,
    deleteCompanyMembership,
    loading,
  } = useContext(CompanyMembershipsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { profiles, loadProfiles } = useContext(ProfilesListContext);
  const { permissions } = useContext(PermissionsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#1b1b1b' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const destructiveColor = useThemeColor({}, 'button');
  const destructiveTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const canEdit = permissions.includes('updateCompanyMembership');
  const canDelete = permissions.includes('deleteCompanyMembership');

  useEffect(() => {
    if (!canEdit) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar membresías.');
      router.back();
    }
  }, [canEdit, router]);

  useEffect(() => {
    void loadCompanies();
    void loadProfiles();
    void loadCompanyMemberships();
  }, [loadCompanies, loadProfiles, loadCompanyMemberships]);

  const membership: CompanyMembership | undefined = useMemo(
    () => memberships.find(item => item.id === membershipId),
    [memberships, membershipId]
  );

  useEffect(() => {
    if (!membership) {
      return;
    }
    setCompanyId(membership.company_id);
    setUserId(membership.user_id);
    setRole(membership.role ?? '');
    setStatus(membership.status ?? '');
    setNotes(membership.notes ?? '');
  }, [membership]);

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

  const handleUpdate = useCallback(async () => {
    if (!companyId || !userId) {
      Alert.alert('Datos incompletos', 'Debes seleccionar empresa y usuario.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await updateCompanyMembership(membershipId, {
        company_id: companyId,
        user_id: userId,
        role: role.trim() || undefined,
        status: status.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (ok) {
        Alert.alert('Cambios guardados', 'La membresía se actualizó correctamente.', [
          {
            text: 'Aceptar',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('No se pudo actualizar', 'Intentá nuevamente en unos instantes.');
      }
    } catch (error) {
      console.error('Error updating company membership:', error);
      Alert.alert('Error', 'Ocurrió un error al actualizar la membresía.');
    } finally {
      setSubmitting(false);
    }
  }, [companyId, membershipId, notes, role, router, status, updateCompanyMembership, userId]);

  const handleRemove = useCallback(() => {
    if (!membership) {
      return;
    }

    Alert.alert(
      'Eliminar membresía',
      'Eliminarás el vínculo entre el usuario y la empresa seleccionada. ¿Confirmás la acción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              const deleted = await deleteCompanyMembership(membershipId);
              if (deleted) {
                Alert.alert('Membresía eliminada', 'El usuario ya no pertenece a la empresa.', [
                  {
                    text: 'Aceptar',
                    onPress: () => router.replace('/company_memberships'),
                  },
                ]);
              } else {
                Alert.alert('No se pudo eliminar', 'Intentá nuevamente más tarde.');
              }
            } catch (error) {
              console.error('Error deleting company membership:', error);
              Alert.alert('Error', 'No pudimos eliminar la membresía.');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  }, [deleteCompanyMembership, membership, membershipId, router]);

  if (!membership && loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}> 
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}> 
        <ThemedText>No encontramos la membresía solicitada.</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}> 
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
            <ThemedText style={styles.title}>Editar membresía</ThemedText>

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
              title={submitting ? 'Guardando...' : 'Guardar cambios'}
              onPress={handleUpdate}
              disabled={submitting}
              style={styles.submitButton}
            />

            {canDelete ? (
              <ThemedButton
                title={removing ? 'Eliminando...' : 'Eliminar membresía'}
                onPress={handleRemove}
                disabled={removing}
                style={[styles.deleteButton, { backgroundColor: destructiveColor }]}
                lightTextColor={destructiveTextColor}
                darkTextColor={destructiveTextColor}
              />
            ) : null}
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
  deleteButton: {
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

