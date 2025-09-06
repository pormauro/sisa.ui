import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';

export default function ViewReceiptModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const router = useRouter();
  const { receipts } = useContext(ReceiptsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);

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
    payerName = clients.find(c => c.id === receipt.payer_client_id)?.business_name || 'Sin cliente';
  } else if (receipt.payer_type === 'provider') {
    payerName = providers.find(p => p.id === receipt.payer_provider_id)?.business_name || 'Sin proveedor';
  } else {
    payerName = receipt.payer_other || 'Sin pagador';
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Pagador</Text>
      <Text style={styles.value}>{payerName}</Text>

      <Text style={styles.label}>Fecha</Text>
      <Text style={styles.value}>{receipt.receipt_date}</Text>

      <Text style={styles.label}>Descripción</Text>
      <Text style={styles.value}>{receipt.description || 'Sin descripción'}</Text>

      <Text style={styles.label}>Total</Text>
      <Text style={styles.value}>${receipt.price}</Text>

      <Text style={styles.label}>Cuenta</Text>
      <Text style={styles.value}>{receipt.paid_in_account}</Text>

      <Text style={styles.label}>Categoría ID</Text>
      <Text style={styles.value}>{receipt.category_id}</Text>

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
