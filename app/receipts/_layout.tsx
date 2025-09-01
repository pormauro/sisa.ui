import React from 'react';
import { Stack } from 'expo-router';

export default function ReceiptsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Recibos' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Recibo' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Recibo' }} />
    </Stack>
  );
}
