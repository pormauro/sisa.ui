import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProfilesContext } from '@/contexts/ProfilesContext';

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
  const [items, setItems] = useState<ParticipantItem[]>([]);
  const [newId, setNewId] = useState('');

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
      Alert.alert('ID inválido');
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

  const renderItem = ({ item }: { item: ParticipantItem }) => (
    <View style={styles.bubble}>
      <CircleImagePicker fileId={item.fileId ? item.fileId.toString() : undefined} size={50} />
      <TouchableOpacity style={styles.remove} onPress={() => handleRemove(item.id)}>
        <Text style={styles.removeText}>×</Text>
      </TouchableOpacity>
    </View>
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
        <TextInput
          style={styles.input}
          value={newId}
          onChangeText={setNewId}
          placeholder="ID participante"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Agregar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: 8 },
  bubble: { marginRight: 8 },
  remove: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f00',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12, lineHeight: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
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
});

