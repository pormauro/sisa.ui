// app/providers/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function CreateProvider() {
  const router = useRouter();
  const { addProvider } = useContext(ProvidersContext);
  const { permissions } = useContext(PermissionsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addProvider')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar proveedores.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection]
  );

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

  const selectedCompany = useMemo(() => {
    if (!companyId) return null;
    const numeric = Number(companyId);
    if (!Number.isFinite(numeric)) return null;
    return companies.find(company => company.id === numeric) ?? null;
  }, [companies, companyId]);

  const handleSubmit = async () => {
    if (!companyId) {
      Alert.alert('Error', 'Seleccioná la empresa del proveedor.');
      return;
    }
    setLoading(true);
    const newProviderId = await addProvider({
      company_id: parseInt(companyId, 10),
    });
    setLoading(false);
    if (newProviderId) {
      Alert.alert('Éxito', 'Proveedor creado.');
      completeSelection(newProviderId.toString());
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el proveedor.');
    }
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
            {selectedCompany.name || selectedCompany.legal_name || 'Empresa seleccionada'}
          </ThemedText>
          {selectedCompany.tax_id ? (
            <ThemedText style={styles.summaryMeta}>CUIT: {selectedCompany.tax_id}</ThemedText>
          ) : null}
          {selectedCompany.email ? (
            <ThemedText style={styles.summaryMeta}>{selectedCompany.email}</ThemedText>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Proveedor</ThemedText>
        )}
      </TouchableOpacity>
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
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
