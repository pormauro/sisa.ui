import React from 'react';
import { Stack } from 'expo-router';

export default function CategoriesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Categorías' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Categoría' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Categoría' }} />
    </Stack>
  );
}
