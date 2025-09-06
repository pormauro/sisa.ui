import React from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

interface DetailModalProps {
  visible: boolean;
  item: Record<string, any> | null;
  onClose: () => void;
  showParticipants?: boolean;
}

const fieldLabels: Record<string, string> = {
  id: 'ID',
  client_id: 'Cliente',
  description: 'Descripción',
  job_date: 'Fecha',
  start_time: 'Hora de inicio',
  end_time: 'Hora de fin',
  type_of_work: 'Tipo de trabajo',
  status_id: 'Estado',
  folder_id: 'Carpeta',
  product_service_id: 'Producto/Servicio',
  multiplicative_value: 'Valor multiplicador',
  tariff_id: 'Tarifa',
  manual_amount: 'Monto manual',
  created_at: 'Fecha de creación',
  updated_at: 'Fecha de edición',
};

const defaultLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function DetailModal({ visible, item, onClose, showParticipants }: DetailModalProps) {
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
  const participants = showParticipants && item.participants
    ? typeof item.participants === 'string'
      ? JSON.parse(item.participants)
      : item.participants
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
                {showParticipants && participants.length > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.key}>Participantes:</Text>
                    <Text style={styles.value}>{participants.join(', ')}</Text>
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
