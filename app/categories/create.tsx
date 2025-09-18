// app/categories/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { getDisplayCategories } from '@/utils/categories';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateCategory() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: 'income' | 'expense' }>();
  const { categories, addCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const initialType = params.type === 'expense' ? 'expense' : 'income';
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const pickerBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={setName}
        placeholder="Nombre"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Tipo</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={type}
          onValueChange={(val) => setType(val as 'income' | 'expense')}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="Ingreso" value="income" />
          <Picker.Item label="Gasto" value="expense" />
        </Picker>
      </View>

      <ThemedText style={styles.label}>Categoría padre</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={parentId}
          onValueChange={setParentId}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
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

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Categoría</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
