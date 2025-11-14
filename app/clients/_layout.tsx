import React from 'react';
import { Stack } from 'expo-router';

export default function ClientsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Clientes' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Cliente' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Cliente' }} />
      <Stack.Screen name="viewModal" options={{ title: 'Ver Cliente', presentation: 'modal' }} />
      <Stack.Screen name="finalizedJobs" options={{ title: 'Trabajos finalizados' }} />
      <Stack.Screen name="unpaidInvoices" options={{ title: 'Facturas impagas' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendario A' }} />
    </Stack>
  );
}
