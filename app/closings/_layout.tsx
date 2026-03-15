import React from 'react';
import { Stack } from 'expo-router';

export default function ClosingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Cierres contables' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo cierre' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de cierre' }} />
    </Stack>
  );
}
