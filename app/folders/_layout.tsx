import React from 'react';
import { Stack } from 'expo-router';

export default function FoldersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Carpetas' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Carpeta' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Carpeta' }} />
    </Stack>
  );
}
