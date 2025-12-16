import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FileGallery } from '@/components/FileGallery';

export default function ViewReceiptModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const router = useRouter();
  const { receipts } = useContext(ReceiptsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { categories } = useContext(CategoriesContext);
  const { cashBoxes } = useContext(CashBoxesContext);

  const background = useThemeColor({}, 'background');

  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Recibo no encontrado</ThemedText>
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
  const accountName =
    cashBoxes.find(cb => cb.id === Number(receipt.paid_in_account))?.name ||
    receipt.paid_in_account;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.label}>Fecha</ThemedText>
      <ThemedText style={styles.value}>{receipt.receipt_date}</ThemedText>

      <ThemedText style={styles.title}>{payerTypeLabel}</ThemedText>
      <ThemedText style={styles.name}>{payerName}</ThemedText>

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <ThemedText style={styles.value}>{receipt.description || 'Sin descripción'}</ThemedText>

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <ThemedText style={styles.value}>{category?.name || 'Sin categoría'}</ThemedText>

      <ThemedText style={styles.label}>Cuenta</ThemedText>
      <ThemedText style={styles.value}>{accountName}</ThemedText>

      <ThemedText style={styles.label}>Total</ThemedText>
      <ThemedText style={styles.value}>${receipt.price}</ThemedText>

      <ThemedText style={styles.label}>Archivos</ThemedText>
      <FileGallery
        entityType="receipt"
        entityId={receiptId}
        filesJson={receipt.attached_files ?? null}
      />

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{receipt.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/receipts/${receipt.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  title: { marginTop: 8, fontSize: 20, fontWeight: 'bold' },
  name: { fontSize: 18, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
