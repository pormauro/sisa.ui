import React from 'react';
import { Stack } from 'expo-router';

export default function InvoicesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Facturas' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva factura' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar factura' }} />
    </Stack>
  );
}
