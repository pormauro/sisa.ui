import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProfilesContext, UserProfile } from '@/contexts/ProfilesContext';
import { ProfilesListContext, Profile } from '@/contexts/ProfilesListContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';

interface ParticipantsBubblesProps {
  participants: number[];
  onChange: (ids: number[]) => void;
}

interface ParticipantItem {
  id: number;
  fileId: number | null;
}

export default function ParticipantsBubbles({ participants, onChange }: ParticipantsBubblesProps) {
  const { getProfile } = useContext(ProfilesContext);
  const { profiles } = useContext(ProfilesListContext);
  const [items, setItems] = useState<ParticipantItem[]>([]);
  const [newId, setNewId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedListProfile, setSelectedListProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const textColor = useThemeColor({}, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const modalBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');

  const profileItems = useMemo(
    () => [
      { label: 'Seleccionar perfil', value: '' },
      ...profiles.map(profile => ({ label: profile.username, value: profile.id.toString() })),
    ],
    [profiles]
  );

  useEffect(() => {
    const load = async () => {
      const list: ParticipantItem[] = [];
      for (const id of participants) {
        const profile = await getProfile(id);
        list.push({ id, fileId: profile?.profile_file_id ?? null });
      }
      setItems(list);
    };
    void load();
  }, [participants, getProfile]);

  const handleAdd = async () => {
    const parsed = parseInt(newId, 10);
    if (isNaN(parsed)) {
      Alert.alert('Seleccione un perfil');
      return;
    }
    if (items.some(it => it.id === parsed)) {
      setNewId('');
      return;
    }
    const profile = await getProfile(parsed);
    const updated = [...items, { id: parsed, fileId: profile?.profile_file_id ?? null }];
    setItems(updated);
    onChange(updated.map(it => it.id));
    setNewId('');
  };

  const handleRemove = (id: number) => {
    const updated = items.filter(it => it.id !== id);
    setItems(updated);
    onChange(updated.map(it => it.id));
  };

  const openProfile = async (id: number) => {
    const profileDetails = await getProfile(id);
    const listProfile = profiles.find(p => p.id === id) || null;
    if (profileDetails) {
      setSelectedProfile(profileDetails);
      setSelectedListProfile(listProfile);
      setModalVisible(true);
    }
  };

  const closeProfile = () => {
    setModalVisible(false);
    setSelectedProfile(null);
    setSelectedListProfile(null);
  };

  const renderItem = ({ item }: { item: ParticipantItem }) => (
    <TouchableOpacity style={styles.bubble} onPress={() => openProfile(item.id)}>
      <CircleImagePicker fileId={item.fileId ? item.fileId.toString() : undefined} size={50} />
    </TouchableOpacity>
  );

  return (
    <View>
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => it.id.toString()}
        style={styles.list}
      />
      <View style={styles.addRow}>
        <SearchableSelect
          style={styles.picker}
          items={profileItems}
          selectedValue={newId}
          onValueChange={(value) => setNewId(value?.toString() ?? '')}
          placeholder="Seleccionar perfil"
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: buttonColor }]}
          onPress={handleAdd}
        >
          <Text style={[styles.addButtonText, { color: buttonTextColor }]}>Agregar</Text>
        </TouchableOpacity>
      </View>
      {selectedProfile && (
        <Modal visible={modalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={closeProfile}>
            <Pressable
              style={[styles.modalContainer, { backgroundColor: modalBackground }]}
              onPress={(e) => e.stopPropagation()}
            >
              <CircleImagePicker
                fileId={
                  selectedProfile.profile_file_id
                    ? selectedProfile.profile_file_id.toString()
                    : undefined
                }
                size={150}
              />
              {selectedListProfile && (
                <>
                  <ThemedText style={[styles.modalText, { color: textColor }]}>Usuario: {selectedListProfile.username}</ThemedText>
                  <ThemedText style={[styles.modalText, { color: textColor }]}>Email: {selectedListProfile.email}</ThemedText>
                </>
              )}
              <ThemedText style={[styles.modalText, { color: textColor }]}>Nombre: {selectedProfile.full_name}</ThemedText>
              {selectedProfile.phone ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>Teléfono: {selectedProfile.phone}</ThemedText>
              ) : null}
              {selectedProfile.address ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>Dirección: {selectedProfile.address}</ThemedText>
              ) : null}
              {selectedProfile.cuit ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>CUIT: {selectedProfile.cuit}</ThemedText>
              ) : null}
              <ThemedButton
                title="Eliminar"
                onPress={() => {
                  handleRemove(selectedProfile.id);
                  closeProfile();
                }}
                style={styles.removeButton}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: 8 },
  bubble: { marginRight: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  picker: {
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonText: { color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    maxWidth: '80%',
  },
  modalText: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  removeButton: {
    marginTop: 16,
  },
});

