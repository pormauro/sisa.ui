import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
  Modal,
  FlatList,
  Alert,
  Pressable,
} from 'react-native';
import { UsersContext, AppUser } from '@/contexts/UsersContext';
import { FileContext } from '@/contexts/FilesContext';

interface ParticipantsSelectorProps {
  participants: number[];
  onChange: (p: number[]) => void;
}

interface UserItem extends AppUser {
  uri?: string;
}

export default function ParticipantsSelector({ participants, onChange }: ParticipantsSelectorProps) {
  const { users, loadUsers } = useContext(UsersContext);
  const { getFile } = useContext(FileContext);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!users.length) void loadUsers();

    const load = async () => {
      const mapped: UserItem[] = [];
      for (const u of users) {
        let uri: string | undefined;
        if (u.profile_file_id) {
          const fetched = await getFile(Number(u.profile_file_id));
          if (fetched) uri = fetched;
        }
        mapped.push({ ...u, uri });
      }
      setUserItems(mapped);
    };
    void load();
  }, [users, getFile, loadUsers]);

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

  const availableUsers = userItems.filter(u => !participants.includes(u.id));

  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.label}>Participantes</Text>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {participants.map(id => {
          const user = userItems.find(u => u.id === id);
          return (
            <TouchableOpacity key={id} onPress={() => removeParticipant(id)} style={styles.avatarWrap}>
              {user?.uri ? (
                <Image source={{ uri: user.uri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.placeholder]}>
                  <Text style={styles.placeholderText}>{user?.username?.[0]?.toUpperCase()}</Text>
                </View>
              )}
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
                  {item.uri ? (
                    <Image source={{ uri: item.uri }} style={styles.itemAvatar} />
                  ) : (
                    <View style={[styles.itemAvatar, styles.placeholder]}>
                      <Text style={styles.placeholderText}>{item.username[0]?.toUpperCase()}</Text>
                    </View>
                  )}
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
  placeholder: { backgroundColor: '#999' },
  placeholderText: { color: '#fff', fontWeight: 'bold' },
  add: { borderWidth: 1, borderColor: '#888' },
  addText: { fontSize: 24, lineHeight: 40, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 10, maxHeight: '80%' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  itemAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 16 },
});

