import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import FileGallery from '@/components/FileGallery';

export default function ViewPaymentModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id);
  const router = useRouter();
  const { payments } = useContext(PaymentsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { categories } = useContext(CategoriesContext);

  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    return (
      <View style={styles.container}>
        <Text>Pago no encontrado</Text>
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Acreedor</Text>
      <Text style={styles.value}>{creditorName}</Text>

      <Text style={styles.label}>Tipo de cuenta</Text>
      <Text style={styles.value}>{creditorTypeLabel}</Text>

      <Text style={styles.label}>Fecha</Text>
      <Text style={styles.value}>{payment.payment_date}</Text>

      <Text style={styles.label}>Descripción</Text>
      <Text style={styles.value}>{payment.description || 'Sin descripción'}</Text>

      <Text style={styles.label}>Total</Text>
      <Text style={styles.value}>${payment.price}</Text>

      <Text style={styles.label}>Cuenta</Text>
      <Text style={styles.value}>{payment.paid_with_account}</Text>

      <Text style={styles.label}>Categoría</Text>
      <Text style={styles.value}>{category?.name || 'Sin categoría'}</Text>

      {filesJson ? (
        <>
          <Text style={styles.label}>Archivos</Text>
          <FileGallery filesJson={filesJson} onChangeFilesJson={() => {}} />
        </>
      ) : null}

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{payment.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/payments/${payment.id}`)} />
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
