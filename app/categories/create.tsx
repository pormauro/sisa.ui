// app/categories/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { getDisplayCategories } from '@/utils/categories';

export default function CreateCategory() {
  const router = useRouter();
  const { categories, addCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const displayCategories = useMemo(
    () => getDisplayCategories(categories),
    [categories]
  );

  useEffect(() => {
    if (!permissions.includes('addCategory')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar categorías.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'Ingresa un nombre.');
      return;
    }
    setLoading(true);
    const newCategory = await addCategory({
      name,
      type,
      parent_id: parentId ? parseInt(parentId, 10) : null,
    });
    setLoading(false);
    if (newCategory) {
      Alert.alert('Éxito', 'Categoría creada.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la categoría.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={type}
          onValueChange={(val) => setType(val as 'income' | 'expense')}
          style={styles.picker}
        >
          <Picker.Item label="Ingreso" value="income" />
          <Picker.Item label="Gasto" value="expense" />
        </Picker>
      </View>

      <Text style={styles.label}>Categoría padre</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={parentId}
          onValueChange={setParentId}
          style={styles.picker}
        >
          <Picker.Item label="-- Sin padre --" value="" />
          {displayCategories.map(c => (
            <Picker.Item
              key={c.id}
              label={`${' '.repeat(c.level * 2)}${c.name}`}
              value={c.id.toString()}
            />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Categoría</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#28a745', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
