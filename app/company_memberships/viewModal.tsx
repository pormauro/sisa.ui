import React, { useContext, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompanyMembershipsContext } from '@/contexts/CompanyMembershipsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ViewCompanyMembershipModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const membershipId = useMemo(() => Number(id), [id]);
  const router = useRouter();

  const { memberships, hydrated, loading } = useContext(CompanyMembershipsContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#1b1b1b' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  const membership = memberships.find(item => item.id === membershipId);
  const canEdit = permissions.includes('updateCompanyMembership');

  if (!membership && (!hydrated || loading)) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: background }]}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText style={styles.emptyText}>No pudimos cargar la membresía solicitada.</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}> 
      <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
        <ThemedText style={styles.title}>Detalle de membresía</ThemedText>

        <ThemedText style={styles.label}>Empresa</ThemedText>
        <ThemedText style={styles.value}>{membership.company_name}</ThemedText>

        <ThemedText style={styles.label}>Usuario</ThemedText>
        <ThemedText style={styles.value}>{membership.user_name}</ThemedText>

        {membership.user_email ? (
          <>
            <ThemedText style={styles.label}>Correo</ThemedText>
            <ThemedText style={styles.value}>{membership.user_email}</ThemedText>
          </>
        ) : null}

        {membership.role ? (
          <>
            <ThemedText style={styles.label}>Rol asignado</ThemedText>
            <ThemedText style={styles.value}>{membership.role}</ThemedText>
          </>
        ) : null}

        {membership.status ? (
          <>
            <ThemedText style={styles.label}>Estado</ThemedText>
            <ThemedText style={styles.value}>{membership.status}</ThemedText>
          </>
        ) : null}

        {membership.notes ? (
          <>
            <ThemedText style={styles.label}>Notas</ThemedText>
            <ThemedText style={styles.value}>{membership.notes}</ThemedText>
          </>
        ) : null}

        <ThemedText style={styles.label}>Creada</ThemedText>
        <ThemedText style={styles.value}>
          {membership.created_at ? new Date(membership.created_at).toLocaleString() : 'N/D'}
        </ThemedText>

        <ThemedText style={styles.label}>Actualizada</ThemedText>
        <ThemedText style={styles.value}>
          {membership.updated_at ? new Date(membership.updated_at).toLocaleString() : 'N/D'}
        </ThemedText>

        {canEdit ? (
          <ThemedButton
            title="Editar"
            onPress={() => router.push(`/company_memberships/${membership.id}`)}
            style={styles.editButton}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  value: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
  },
  editButton: {
    marginTop: 16,
  },
});

