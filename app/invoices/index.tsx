import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Fuse from 'fuse.js';
import { useFocusEffect, useRouter } from 'expo-router';

import { InvoicesContext, Invoice } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const normaliseStatus = (status: string | null | undefined) =>
  (status ?? 'issued').toString().toLowerCase();

const getInvoiceNumber = (invoice: Invoice) =>
  invoice.number ?? invoice.invoice_number ?? invoice.code ?? `#${invoice.id}`;

const getDescription = (invoice: Invoice) => invoice.description ?? invoice.notes ?? '';

export default function InvoicesScreen() {
  const { invoices, loadInvoices } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const secondaryText = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canList = permissions.includes('listInvoices');
  const canCreateInvoice =
    permissions.includes('createInvoice') ||
    permissions.includes('submitAfipInvoice') ||
    permissions.includes('updateInvoice');

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver facturas.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadInvoices();
    }, [canList, loadInvoices])
  );

  const fuse = useMemo(
    () =>
      new Fuse(invoices, {
        keys: ['number', 'invoice_number', 'code', 'description', 'notes', 'status', 'client_name'],
        threshold: 0.3,
      }),
    [invoices]
  );

  const filteredInvoices = useMemo(() => {
    if (!search) {
      return invoices;
    }
    const results = fuse.search(search.trim());
    return results.map(result => result.item);
  }, [fuse, invoices, search]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
      return '—';
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(Number(value));
  };

  const resolveClientName = (invoice: Invoice) => {
    if (invoice.client_name) {
      return invoice.client_name;
    }
    const clientId = invoice.client_id ?? invoice.clientId;
    if (!clientId) {
      return null;
    }
    return clients.find(client => client.id === Number(clientId))?.business_name ?? null;
  };

  const resolveProviderName = (invoice: Invoice) => {
    if (invoice.provider_name) {
      return invoice.provider_name;
    }
    const providerId = invoice.provider_id ?? invoice.providerId;
    if (!providerId) {
      return null;
    }
    return providers.find(provider => provider.id === Number(providerId))?.business_name ?? null;
  };

  const getStatusLabel = (status: string | null | undefined) => {
    const normalised = normaliseStatus(status);
    if (normalised === 'paid') {
      return 'Pagada';
    }
    if (normalised === 'cancelled' || normalised === 'canceled') {
      return 'Anulada';
    }
    return 'Emitida';
  };

  const getStatusStyle = (status: string | null | undefined) => {
    const normalised = normaliseStatus(status);
    if (normalised === 'paid') {
      return [styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: 'rgba(22,163,74,0.4)' }];
    }
    if (normalised === 'cancelled' || normalised === 'canceled') {
      return [styles.statusBadge, { backgroundColor: 'rgba(248,113,113,0.18)', borderColor: 'rgba(220,38,38,0.4)' }];
    }
    return [styles.statusBadge, { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(37,99,235,0.35)' }];
  };

  const renderItem = ({ item }: { item: Invoice }) => {
    const clientName = resolveClientName(item);
    const providerName = resolveProviderName(item);
    const total = formatCurrency(item.total ?? item.amount ?? item.total_amount ?? item.subtotal);
    const statusLabel = getStatusLabel(item.status ?? item.state);

    return (
      <TouchableOpacity
        style={[styles.item, { borderColor: itemBorderColor }]}
        onPress={() => router.push({ pathname: '/invoices/viewModal', params: { id: item.id.toString() } })}
      >
        <View style={styles.itemContent}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.invoiceNumber}>{getInvoiceNumber(item)}</ThemedText>
            <View style={getStatusStyle(item.status ?? item.state)}>
              <ThemedText style={styles.statusText}>{statusLabel}</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.description, { color: secondaryText }]}>
            {getDescription(item) || 'Sin descripción'}
          </ThemedText>
          {clientName ? (
            <ThemedText style={styles.detailLine}>Cliente: {clientName}</ThemedText>
          ) : null}
          {providerName ? (
            <ThemedText style={styles.detailLine}>Proveedor: {providerName}</ThemedText>
          ) : null}
          <ThemedText style={styles.totalLine}>Total: {total}</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        style={[styles.search, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Buscar factura..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={placeholderColor}
      />
      {canCreateInvoice ? (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: buttonColor }]}
          onPress={() => router.push('/invoices/create')}
        >
          <ThemedText style={[styles.createButtonText, { color: buttonTextColor }]}>Nueva factura AFIP</ThemedText>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={filteredInvoices}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No se encontraron facturas.</ThemedText>
        }
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  listContent: { paddingBottom: 24 },
  createButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  itemContent: { flex: 1, paddingRight: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invoiceNumber: { fontSize: 16, fontWeight: 'bold' },
  description: { marginTop: 4, fontSize: 14 },
  detailLine: { marginTop: 4, fontSize: 14 },
  totalLine: { marginTop: 6, fontSize: 15, fontWeight: '600' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
});
