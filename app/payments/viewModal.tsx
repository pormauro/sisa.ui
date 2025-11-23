import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import FileGallery from '@/components/FileGallery';

export default function ViewPaymentModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id);
  const router = useRouter();
  const { payments } = useContext(PaymentsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { categories } = useContext(CategoriesContext);
  const { cashBoxes } = useContext(CashBoxesContext);

  const background = useThemeColor({}, 'background');

  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Pago no encontrado</ThemedText>
      </View>
    );
  }

  let creditorName = '';
  if (payment.creditor_type === 'client') {
    creditorName =
      clients.find(c => c.id === payment.creditor_client_id)?.business_name ||
      'Sin cliente';
  } else if (payment.creditor_type === 'provider') {
    creditorName =
      providers.find(p => p.id === payment.creditor_provider_id)?.business_name ||
      'Sin proveedor';
  } else {
    creditorName = payment.creditor_other || 'Sin acreedor';
  }

  const creditorTypeLabel =
    payment.creditor_type === 'client'
      ? 'Cliente'
      : payment.creditor_type === 'provider'
      ? 'Proveedor'
      : 'Otro';

  const category = categories.find(c => c.id === payment.category_id);
  const filesJson = payment.attached_files
    ? typeof payment.attached_files === 'string'
      ? payment.attached_files
      : JSON.stringify(payment.attached_files)
    : '';

  const accountName =
    cashBoxes.find(cb => cb.id === Number(payment.paid_with_account))?.name ||
    payment.paid_with_account;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.label}>Fecha</ThemedText>
      <ThemedText style={styles.value}>{payment.payment_date}</ThemedText>

      <ThemedText style={styles.title}>{creditorTypeLabel}</ThemedText>
      <ThemedText style={styles.name}>{creditorName}</ThemedText>

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <ThemedText style={styles.value}>{payment.description || 'Sin descripción'}</ThemedText>

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <ThemedText style={styles.value}>{category?.name || 'Sin categoría'}</ThemedText>

      <ThemedText style={styles.label}>Cuenta</ThemedText>
      <ThemedText style={styles.value}>{accountName}</ThemedText>

      <ThemedText style={styles.label}>Total</ThemedText>
      <ThemedText style={styles.value}>${payment.price}</ThemedText>

      {filesJson ? (
        <>
          <ThemedText style={styles.label}>Archivos</ThemedText>
          <FileGallery
            filesJson={filesJson}
            onChangeFilesJson={() => {}}
            invoiceMarkingEnabled
          />
        </>
      ) : null}

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{payment.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/payments/${payment.id}`)} />
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
