import React from 'react';
import { Stack } from 'expo-router';

export default function AppointmentsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Citas' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Cita' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Cita' }} />
      <Stack.Screen name="viewModal" options={{ title: 'Detalle de Cita', presentation: 'modal' }} />
    </Stack>
  );
}
