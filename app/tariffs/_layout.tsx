import React from 'react';
import { Stack } from 'expo-router';

export default function TariffsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Tarifas' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Tarifa' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Tarifa' }} />
    </Stack>
  );
}
