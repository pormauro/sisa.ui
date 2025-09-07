import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProfilesContext } from '@/contexts/ProfilesContext';
import { ProfilesListContext } from '@/contexts/ProfilesListContext';
import { useThemeColor } from '@/hooks/useThemeColor';

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

  const textColor = useThemeColor({}, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

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
        <Picker
          selectedValue={newId}
          onValueChange={(value) => setNewId(String(value))}
          style={[styles.picker, { color: textColor }]}
          dropdownIconColor={textColor}
        >
          <Picker.Item label="Seleccionar perfil" value="" />
          {profiles.map((p) => (
            <Picker.Item key={p.id} label={p.username} value={p.id.toString()} />
          ))}
        </Picker>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: buttonColor }]}
          onPress={handleAdd}
        >
          <Text style={[styles.addButtonText, { color: buttonTextColor }]}>Agregar</Text>
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
});

