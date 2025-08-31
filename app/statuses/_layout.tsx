// app/statuses/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function StatusesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Estados' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Estado' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Estado' }} />
    </Stack>
  );
}
