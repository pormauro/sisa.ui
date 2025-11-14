// /app/clients/create.tsx
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';

export default function CreateClientPage() {
  const { permissions } = useContext(PermissionsContext);
  const { addClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const router = useRouter();
  const {
    beginSelection,
    completeSelection,
    cancelSelection,
    consumeSelection,
    pendingSelections,
  } = usePendingSelection();

  const NEW_TARIFF_VALUE = 'new_tariff';

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [companyId, setCompanyId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [tariffId, setTariffId] = useState<string>('');
  const submittingRef = useRef(false);

  const tariffItems = useMemo(
    () => [
      { label: 'Sin Tarifa', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...tariffs.map(t => ({ label: `${t.name} - ${t.amount}`, value: t.id.toString() })),
    ],
    [tariffs]
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

  useEffect(() => {
    if (!permissions.includes('addClient')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear clientes.');
      router.back();
    }
  }, []);

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  useEffect(() => {
    if (
      !Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.clients.tariff)
    ) {
      return;
    }
    const pendingTariffId = consumeSelection<string>(SELECTION_KEYS.clients.tariff);
    if (!pendingTariffId) {
      return;
    }
    const exists = tariffs.some(tariff => tariff.id.toString() === pendingTariffId);
    if (!exists) {
      return;
    }
    setTariffId(pendingTariffId);
  }, [pendingSelections, consumeSelection, tariffs]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);
  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!companyId) {
      Alert.alert('Datos incompletos', 'Seleccioná la empresa del cliente.');
      submittingRef.current = false;
      return;
    }
    setLoading(true);
    try {
      const newClientId = await addClient({
        company_id: parseInt(companyId, 10),
        phone,
        address,
        tariff_id: tariffId ? parseInt(tariffId, 10) : null,
      });
      if (newClientId) {
        Alert.alert('Éxito', 'Cliente creado exitosamente');
        completeSelection(newClientId.toString());
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo crear el cliente');
      }
    } catch (err) {
      console.error('Error creating client:', err);
      Alert.alert('Error', 'No se pudo crear el cliente');
    } finally {
      setLoading(false);
      submittingRef.current = false;
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
        onValueChange={(value) => setCompanyId(value?.toString() ?? '')}
        placeholder="-- Selecciona una empresa --"
        onItemLongPress={(item) => {
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

      <ThemedText style={styles.label}>Teléfono</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Dirección</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Dirección"
        value={address}
        onChangeText={setAddress}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Tarifa</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={tariffItems}
        selectedValue={tariffId}
        onValueChange={(itemValue) => {
          const value = itemValue?.toString() ?? '';
          if (value === NEW_TARIFF_VALUE) {
            setTariffId('');
            beginSelection(SELECTION_KEYS.clients.tariff);
            router.push('/tariffs/create');
            return;
          }
          setTariffId(value);
        }}
        placeholder="Sin Tarifa"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.clients.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
          {loading ? 'Creando...' : 'Crear Cliente'}
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  select: {
    marginBottom: 8,
  },
  companySummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryMeta: {
    fontSize: 14,
  },
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
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
