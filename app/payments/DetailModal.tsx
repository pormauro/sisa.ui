import React from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

interface DetailModalProps {
  visible: boolean;
  item: Record<string, any> | null;
  onClose: () => void;
}

const fieldLabels: Record<string, string> = {
  id: 'ID',
  payment_date: 'Fecha',
  paid_with_account: 'Pagado con cuenta',
  creditor_type: 'Tipo acreedor',
  creditor_client_id: 'Cliente acreedor',
  creditor_provider_id: 'Proveedor acreedor',
  creditor_other: 'Otro acreedor',
  description: 'Descripción',
  category_id: 'Categoría',
  price: 'Precio',
  charge_client: 'Cobrar al cliente',
  client_id: 'Cliente',
  created_at: 'Fecha de creación',
  updated_at: 'Fecha de edición',
};

const defaultLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function DetailModal({ visible, item, onClose }: DetailModalProps) {
  if (!item) return null;
  const entries = Object.entries(item).filter(
    ([key]) =>
      key !== 'attached_files' &&
      key !== 'participants' &&
      !key.endsWith('_file_id')
  );
  const attachments = item.attached_files
    ? typeof item.attached_files === 'string'
      ? JSON.parse(item.attached_files)
      : item.attached_files
    : [];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <FlatList
            data={entries}
            keyExtractor={([k]) => k}
            renderItem={({ item: [k, v] }) => (
              <View style={styles.row}>
                <Text style={styles.key}>{fieldLabels[k] ?? defaultLabel(k)}:</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            )}
            ListHeaderComponent={(
              <>
                {attachments.length > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.key}>Adjuntos:</Text>
                    <Text style={styles.value}>📎 {attachments.length}</Text>
                  </View>
                )}
              </>
            )}
          />
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 8, padding: 16, width: '80%', maxHeight: '80%' },
  row: { flexDirection: 'row', marginBottom: 8 },
  key: { fontWeight: 'bold', marginRight: 4 },
  value: { flex: 1, flexWrap: 'wrap' },
  closeButton: { marginTop: 12, alignSelf: 'center' },
  closeText: { color: '#007BFF' },
});
