// /app/clients/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ClientsContext } from '@/contexts/ClientsContext';
import type { ClientCompanySummary } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';


export default function ClientDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEditClient = permissions.includes('updateClient');
  const canDeleteClient = permissions.includes('deleteClient');
  const canViewClientCalendar = permissions.includes('listAppointments') || permissions.includes('listJobs');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); // Cambiado aquí
  const clientId = Number(id);
  const { clients, loadClients, updateClient, deleteClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const {
    beginSelection,
    completeSelection,
    cancelSelection,
    consumeSelection,
    pendingSelections,
  } = usePendingSelection();

  const client = clients.find(c => c.id === clientId);

  const NEW_TARIFF_VALUE = 'new_tariff';

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#92272f' }, 'background');
  const deleteButtonTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const [companyId, setCompanyId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [tariffId, setTariffId] = useState<string>('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

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
    return client?.company ?? null;
  }, [client?.company, companies, companyId]);

  useEffect(() => {
    if (!canEditClient && !canDeleteClient) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este cliente.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

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

  useEffect(() => {
    if (client) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setCompanyId(client.company_id ? client.company_id.toString() : '');
      setPhone(client.phone ?? '');
      setAddress(client.address ?? '');
      setTariffId(client.tariff_id ? client.tariff_id.toString() : '');
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadClients()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [client, hasAttemptedLoad, isFetchingItem, loadClients]);

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Cliente no encontrado</ThemedText>
        )}
      </View>
    );
  }

  const handleUpdate = () => {
    /*if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, CUIT y Email');
      return;
    }*/
    Alert.alert(
      'Confirmar actualización',
      '¿Estás seguro de que deseas actualizar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            const success = await updateClient(clientId, {
              company_id: companyId ? parseInt(companyId, 10) : undefined,
              phone,
              address,
              tariff_id: tariffId ? parseInt(tariffId, 10) : null,
            });
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente actualizado');
              completeSelection(clientId.toString());
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo actualizar el cliente');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  

  const handleDelete = async () => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => {
            setLoading(true);
            const success = await deleteClient(clientId);
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente eliminado');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo eliminar el cliente');
            }
          }
        },
      ]
    );
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
        disabled={!canEditClient}
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
        disabled={!canEditClient}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.clients.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />
      {canViewClientCalendar && (
        <TouchableOpacity
          style={[styles.calendarButton, { backgroundColor: buttonColor }]}
          onPress={() => router.push({ pathname: '/clients/calendar', params: { id: client.id.toString() } })}
        >
          <ThemedText style={[styles.calendarButtonText, { color: buttonTextColor }]}>Abrir Calendario A</ThemedText>
        </TouchableOpacity>
      )}
      {canEditClient && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {canDeleteClient && (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
          onPress={handleDelete}
        >
          {loading ? (
            <ActivityIndicator color={deleteButtonTextColor} />
          ) : (
            <ThemedText style={[styles.deleteButtonText, { color: deleteButtonTextColor }]}>Eliminar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, flexGrow: 1 },
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
  calendarButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  calendarButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: 'bold' },
});
