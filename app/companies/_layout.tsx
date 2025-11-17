import React from 'react';
import { Stack } from 'expo-router';

export default function CompaniesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Empresas' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Empresa' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Empresa' }} />
      <Stack.Screen name="viewModal" options={{ title: 'Detalle de la Empresa', presentation: 'modal' }} />
      <Stack.Screen name="memberships" options={{ title: 'Personas de la empresa' }} />
    </Stack>
  );
}
