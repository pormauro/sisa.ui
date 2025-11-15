// app/providers/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';
import type { ClientCompanySummary } from '@/contexts/ClientsContext';

export default function ProviderDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateProvider');
  const canDelete = permissions.includes('deleteProvider');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const { providers, loadProviders, updateProvider, deleteProvider } = useContext(ProvidersContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const provider = providers.find(p => p.id === providerId);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#92272f' }, 'background');
  const deleteButtonTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este proveedor.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  const companyItems = useMemo(() => {
    const formatter = (company: Company) => {
      const commercial = (company.name ?? '').trim();
      const legal = (company.legal_name ?? '').trim();
      return commercial || legal || `Empresa #${company.id}`;
    };
    return companies
      .map(company => ({ label: formatter(company), value: company.id.toString() }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [companies]);

  const selectedCompany = useMemo<Company | ClientCompanySummary | null>(() => {
    if (companyId) {
      const numeric = Number(companyId);
      if (Number.isFinite(numeric)) {
        const existing = companies.find(company => company.id === numeric);
        if (existing) {
          return existing;
        }
      }
    }
    return provider?.company ?? null;
  }, [companies, companyId, provider?.company]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection]
  );

  useEffect(() => {
    if (provider) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setCompanyId(provider.company_id ? provider.company_id.toString() : '');
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadProviders()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [provider, hasAttemptedLoad, isFetchingItem, loadProviders]);

  if (!provider) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Proveedor no encontrado</ThemedText>
        )}
      </View>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar este proveedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateProvider(providerId, {
            company_id: companyId ? parseInt(companyId, 10) : undefined,
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Proveedor actualizado');
            completeSelection(providerId.toString());
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el proveedor');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este proveedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteProvider(providerId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Proveedor eliminado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el proveedor');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Empresa</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={[
          { label: '-- Selecciona una empresa --', value: '' },
          ...companyItems,
        ]}
        selectedValue={companyId}
        onValueChange={value => setCompanyId(value?.toString() ?? '')}
        placeholder="-- Selecciona una empresa --"
        disabled={!canEdit}
        onItemLongPress={item => {
          const value = String(item.value ?? '');
          if (!value) return;
          router.push(`/companies/${value}`);
        }}
      />
      <View style={styles.companyActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor }]}
          onPress={() => router.push('/companies/create')}
        >
          <ThemedText style={{ color: inputTextColor }}>Crear empresa</ThemedText>
        </TouchableOpacity>
        {companyId ? (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor }]}
            onPress={() => router.push(`/companies/${companyId}`)}
          >
            <ThemedText style={{ color: inputTextColor }}>Ver empresa</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {selectedCompany ? (
        <View style={[styles.companySummary, { borderColor }]}> 
          <ThemedText style={[styles.summaryTitle, { color: inputTextColor }]}>Resumen</ThemedText>
          <ThemedText style={styles.summaryText}>
            {'name' in selectedCompany && selectedCompany.name
              ? selectedCompany.name
              : 'legal_name' in selectedCompany && selectedCompany.legal_name
              ? selectedCompany.legal_name
              : 'business_name' in selectedCompany && selectedCompany.business_name
              ? selectedCompany.business_name
              : 'Empresa seleccionada'}
          </ThemedText>
          {'tax_id' in selectedCompany && selectedCompany.tax_id ? (
            <ThemedText style={styles.summaryMeta}>CUIT: {selectedCompany.tax_id}</ThemedText>
          ) : null}
          {'email' in selectedCompany && selectedCompany.email ? (
            <ThemedText style={styles.summaryMeta}>{selectedCompany.email}</ThemedText>
          ) : null}
        </View>
      ) : null}

      {canEdit && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar</ThemedText>
          )}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={deleteButtonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: deleteButtonTextColor }]}>Eliminar</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  select: { marginBottom: 8 },
  companySummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 14, marginBottom: 4 },
  summaryText: { fontSize: 16, fontWeight: 'bold' },
  summaryMeta: { fontSize: 14 },
  companyActions: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    padding: 10,
  },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
