import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

interface ParticipantsBubblesProps {
  participants: number[];
  onChange: (ids: number[]) => void;
}

interface ParticipantItem {
  id: number;
  fileId: number | null;
}

export default function ParticipantsBubbles({ participants, onChange }: ParticipantsBubblesProps) {
  const { token, userId } = useContext(AuthContext);
  const [items, setItems] = useState<ParticipantItem[]>([]);
  const [newId, setNewId] = useState('');

  const fetchProfileImage = useCallback(async (uid: number): Promise<number | null> => {
    if (!token) return null;
    try {
      const endpoint = uid === Number(userId) ? `${BASE_URL}/profile` : `${BASE_URL}/profiles/${uid}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const data = await res.json();
      const profile = data.profile || data.user || {};
      return profile.profile_file_id ?? null;
    } catch {
      return null;
    }
  }, [token, userId]);

  useEffect(() => {
    const currentIds = items.map(it => it.id);
    const same =
      participants.length === currentIds.length &&
      participants.every((id, idx) => id === currentIds[idx]);
    if (same) return;

    const load = async () => {
      const list: ParticipantItem[] = [];
      for (const id of participants) {
        const existing = items.find(it => it.id === id);
        if (existing) {
          list.push(existing);
        } else {
          const fileId = await fetchProfileImage(id);
          list.push({ id, fileId });
        }
      }
      setItems(list);
    };
    void load();
  }, [participants, items, fetchProfileImage]);

  useEffect(() => {
    onChange(items.map(it => it.id));
  }, [items, onChange]);

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
    const fileId = await fetchProfileImage(parsed);
    setItems(prev => [...prev, { id: parsed, fileId }]);
    setNewId('');
  };

  const handleRemove = (id: number) => {
    setItems(prev => prev.filter(it => it.id !== id));
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

