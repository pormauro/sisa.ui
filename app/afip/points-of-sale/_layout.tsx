import React from 'react';
import { Stack } from 'expo-router';

export default function AfipPointsOfSaleLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Puntos de venta AFIP' }} />
      <Stack.Screen
        name="new"
        options={{ title: 'Punto de venta', presentation: 'modal', headerBackTitle: 'Volver' }}
      />
    </Stack>
  );
}
