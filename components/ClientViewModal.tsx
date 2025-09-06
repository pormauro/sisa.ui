import React, { useContext } from 'react';
import { Modal, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CircleImagePicker from './CircleImagePicker';
import { Client } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';

interface Props {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
}

export default function ClientViewModal({ visible, client, onClose }: Props) {
  const { tariffs } = useContext(TariffsContext);

  if (!client) return null;

  const tariff = tariffs.find(t => t.id === client.tariff_id);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>ID</Text>
        <Text style={styles.value}>{client.id}</Text>

        <Text style={styles.label}>Fecha de creación</Text>
        <Text style={styles.value}>{client.created_at || '-'}</Text>

        <Text style={styles.label}>Fecha de modificación</Text>
        <Text style={styles.value}>{client.updated_at || '-'}</Text>

        <Text style={styles.label}>Imagen del Cliente</Text>
        <CircleImagePicker fileId={client.brand_file_id} size={200} />

        <Text style={styles.label}>Nombre del Negocio</Text>
        <Text style={styles.value}>{client.business_name}</Text>

        <Text style={styles.label}>Tax ID</Text>
        <Text style={styles.value}>{client.tax_id}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{client.email}</Text>

        <Text style={styles.label}>Teléfono</Text>
        <Text style={styles.value}>{client.phone}</Text>

        <Text style={styles.label}>Dirección</Text>
        <Text style={styles.value}>{client.address}</Text>

        <Text style={styles.label}>Tarifa</Text>
        <Text style={styles.value}>{tariff ? `${tariff.name} - ${tariff.amount}` : 'Sin Tarifa'}</Text>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Cerrar</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { marginBottom: 8, fontSize: 16 },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#007BFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

