import React from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

interface DetailModalProps {
  visible: boolean;
  item: Record<string, any> | null;
  onClose: () => void;
}

const fieldLabels: Record<string, string> = {
  id: 'ID',
  label: 'Etiqueta',
  value: 'Valor',
  background_color: 'Color de fondo',
  order_index: 'Orden',
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
