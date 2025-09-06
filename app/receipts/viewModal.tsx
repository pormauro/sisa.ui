import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import FileGallery from '@/components/FileGallery';

export default function ViewReceiptModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const router = useRouter();
  const { receipts } = useContext(ReceiptsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { categories } = useContext(CategoriesContext);
  const { cashBoxes } = useContext(CashBoxesContext);

  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) {
    return (
      <View style={styles.container}>
        <Text>Recibo no encontrado</Text>
      </View>
    );
  }

  let payerName = '';
  if (receipt.payer_type === 'client') {
    payerName =
      clients.find(c => c.id === receipt.payer_client_id)?.business_name ||
      'Sin cliente';
  } else if (receipt.payer_type === 'provider') {
    payerName =
      providers.find(p => p.id === receipt.payer_provider_id)?.business_name ||
      'Sin proveedor';
  } else {
    payerName = receipt.payer_other || 'Sin pagador';
  }

  const payerTypeLabel =
    receipt.payer_type === 'client'
      ? 'Cliente'
      : receipt.payer_type === 'provider'
      ? 'Proveedor'
      : 'Otro';

  const category = categories.find(c => c.id === receipt.category_id);
  const filesJson = receipt.attached_files
    ? typeof receipt.attached_files === 'string'
      ? receipt.attached_files
      : JSON.stringify(receipt.attached_files)
    : '';

  const accountName =
    cashBoxes.find(cb => cb.id === Number(receipt.paid_in_account))?.name ||
    receipt.paid_in_account;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Pagador</Text>
      <Text style={styles.value}>{payerName}</Text>

      <Text style={styles.label}>Tipo de cuenta</Text>
      <Text style={styles.value}>{payerTypeLabel}</Text>

      <Text style={styles.label}>Fecha</Text>
      <Text style={styles.value}>{receipt.receipt_date}</Text>

      <Text style={styles.label}>Descripción</Text>
      <Text style={styles.value}>{receipt.description || 'Sin descripción'}</Text>

      <Text style={styles.label}>Total</Text>
      <Text style={styles.value}>${receipt.price}</Text>

      <Text style={styles.label}>Cuenta</Text>
      <Text style={styles.value}>{accountName}</Text>

      <Text style={styles.label}>Categoría</Text>
      <Text style={styles.value}>{category?.name || 'Sin categoría'}</Text>

      {filesJson ? (
        <>
          <Text style={styles.label}>Archivos</Text>
          <FileGallery filesJson={filesJson} onChangeFilesJson={() => {}} />
        </>
      ) : null}

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{receipt.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/receipts/${receipt.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
