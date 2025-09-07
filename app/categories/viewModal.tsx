import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ViewCategoryModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const router = useRouter();
  const { categories } = useContext(CategoriesContext);

  const background = useThemeColor({}, 'background');

  const category = categories.find(c => c.id === categoryId);
  const parent = categories.find(c => c.id === category?.parent_id);

  if (!category) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Categoría no encontrada</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <ThemedText style={styles.value}>{category.name}</ThemedText>

      <ThemedText style={styles.label}>Tipo</ThemedText>
      <ThemedText style={styles.value}>{category.type === 'income' ? 'Ingreso' : 'Gasto'}</ThemedText>

      <ThemedText style={styles.label}>Categoría padre</ThemedText>
      <ThemedText style={styles.value}>{parent ? parent.name : 'Sin padre'}</ThemedText>

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{category.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/categories/${category.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
