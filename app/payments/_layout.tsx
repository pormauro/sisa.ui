import React from 'react';
import { Stack } from 'expo-router';

export default function PaymentsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Pagos' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Pago' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Pago' }} />
      <Stack.Screen name="viewModal" options={{ title: 'Ver Pago', presentation: 'modal' }} />
    </Stack>
  );
}
