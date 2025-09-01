import React from 'react';
import { Stack } from 'expo-router';

export default function ProvidersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Proveedores' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Proveedor' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Proveedor' }} />
    </Stack>
  );
}
