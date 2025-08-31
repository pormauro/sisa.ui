// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function CashBoxesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Cajas' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Caja' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Caja' }} />
    </Stack>
  );
}
