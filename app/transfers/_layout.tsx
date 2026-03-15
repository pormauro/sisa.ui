import React from 'react';
import { Stack } from 'expo-router';

export default function TransfersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Transferencias' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva transferencia' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de transferencia' }} />
    </Stack>
  );
}
