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
  participants: number[];
  onChange: (p: number[]) => void;
}

export default function ParticipantsSelector({ participants, onChange }: ParticipantsSelectorProps) {
  const { users, loadUsers } = useContext(UsersContext);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!users.length) void loadUsers();
  }, [users, loadUsers]);

  const addParticipant = (id: number) => {
    if (!participants.includes(id)) {
      onChange([...participants, id]);
    }
  };

  const removeParticipant = (id: number) => {
    Alert.alert('Eliminar participante', '¿Deseas quitar este participante?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onChange(participants.filter(p => p !== id)) },
    ]);
  };

  const availableUsers = users.filter(u => !participants.includes(u.id));

  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.label}>Participantes</Text>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {participants.map(id => {
          const user = users.find(u => u.id === id);
          return (
            <TouchableOpacity key={id} onPress={() => removeParticipant(id)} style={styles.avatarWrap}>
              <CircleImagePicker
                fileId={user?.profile_file_id || undefined}
                size={40}
                editable={false}
              />
            </TouchableOpacity>
          );
        })}
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
                    addParticipant(item.id);
                    setModalVisible(false);
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

