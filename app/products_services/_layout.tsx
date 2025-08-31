// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function CashBoxesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Productos y Servicios' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Producto/Servicio' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Producto/Servicio' }} />
    </Stack>
  );
}
