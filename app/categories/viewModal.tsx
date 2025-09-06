import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { CategoriesContext } from '@/contexts/CategoriesContext';

export default function ViewCategoryModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const router = useRouter();
  const { categories } = useContext(CategoriesContext);

  const category = categories.find(c => c.id === categoryId);
  const parent = categories.find(c => c.id === category?.parent_id);

  if (!category) {
    return (
      <View style={styles.container}>
        <Text>Categoría no encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <Text style={styles.value}>{category.name}</Text>

      <Text style={styles.label}>Tipo</Text>
      <Text style={styles.value}>{category.type === 'income' ? 'Ingreso' : 'Gasto'}</Text>

      <Text style={styles.label}>Categoría padre</Text>
      <Text style={styles.value}>{parent ? parent.name : 'Sin padre'}</Text>

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{category.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/categories/${category.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
