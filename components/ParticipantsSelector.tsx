import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  FlatList,
  Alert,
  Pressable,
} from 'react-native';
import { UsersContext } from '@/contexts/UsersContext';
import CircleImagePicker from './CircleImagePicker';

interface ParticipantsSelectorProps {
  /** Lista de IDs de archivos de imagen de los usuarios seleccionados */
  participants: number[];
  /** Callback cuando cambia la lista de IDs de imagen */
  onChange: (p: number[]) => void;
}

/**
 * Selector de participantes basado en los IDs de imágenes (profile_file_id).
 * Mantiene internamente un listado de IDs de archivo y expone un JSON
 * sólo con estos identificadores, evitando mezclar los IDs de usuario.
 */
export default function ParticipantsSelector({ participants, onChange }: ParticipantsSelectorProps) {
  const { users, loadUsers } = useContext(UsersContext);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!users.length) void loadUsers();
  }, [users, loadUsers]);

  const addParticipant = (fileId: number) => {
    if (!participants.includes(fileId)) {
      onChange([...participants, fileId]);
    }
  };

  const removeParticipant = (fileId: number) => {
    Alert.alert('Eliminar participante', '¿Deseas quitar este participante?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onChange(participants.filter(p => p !== fileId)) },
    ]);
  };

  const availableUsers = users.filter(u => {
    if (!u.profile_file_id) return false;
    return !participants.includes(parseInt(u.profile_file_id, 10));
  });

  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.label}>Participantes</Text>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {participants.map(fileId => (
          <TouchableOpacity
            key={fileId}
            onPress={() => removeParticipant(fileId)}
            style={styles.avatarWrap}
          >
            <CircleImagePicker fileId={fileId.toString()} size={40} editable={false} />
          </TouchableOpacity>
        ))}
        <Pressable
          style={[styles.avatar, styles.add]}
          onPress={e => {
            e.stopPropagation();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </ScrollView>
      <Modal transparent visible={modalVisible} animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable
            style={styles.modalBox}
            onPress={e => {
              e.stopPropagation();
            }}
          >
            <FlatList
              data={availableUsers}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    if (item.profile_file_id) {
                      addParticipant(parseInt(item.profile_file_id, 10));
                      setModalVisible(false);
                    }
                  }}
                >
                  <CircleImagePicker
                    fileId={item.profile_file_id || undefined}
                    size={40}
                    editable={false}
                    style={styles.itemAvatar}
                  />
                  <Text style={styles.itemText}>{item.username}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, marginBottom: 8 },
  row: { alignItems: 'center' },
  avatarWrap: { marginRight: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1, borderColor: '#888' },
  addText: { fontSize: 24, lineHeight: 40, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 10, maxHeight: '80%' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  itemAvatar: { marginRight: 10 },
  itemText: { fontSize: 16 },
});

