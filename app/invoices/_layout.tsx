import React from 'react';
import { Stack } from 'expo-router';

export default function InvoicesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Facturación' }} />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Detalle de factura', presentation: 'modal' }}
      />
      <Stack.Screen
        name="viewModal"
        options={{ title: 'Factura', presentation: 'modal' }}
      />
    </Stack>
  );
}
