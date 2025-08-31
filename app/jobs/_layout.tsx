// C:/Users/Mauri/Documents/GitHub/router/app/jobs/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function JobsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Trabajos' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Trabajo' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Trabajo' }} />
    </Stack>
  );
}
