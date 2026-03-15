import React from 'react';
import { Stack } from 'expo-router';

export default function AccountsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Cuentas contables' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva cuenta' }} />
      <Stack.Screen name="edit" options={{ title: 'Editar cuenta' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de cuenta' }} />
    </Stack>
  );
}
