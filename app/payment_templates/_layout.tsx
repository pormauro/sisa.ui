import React from 'react';
import { Stack } from 'expo-router';

export default function PaymentTemplatesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Plantillas de pago' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva plantilla' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar plantilla' }} />
      <Stack.Screen name="viewModal" options={{ title: 'Detalle de plantilla', presentation: 'modal' }} />
    </Stack>
  );
}
