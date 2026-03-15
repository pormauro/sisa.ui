import React from 'react';
import { Stack } from 'expo-router';

export default function JournalEntriesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Libro diario' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de asiento' }} />
    </Stack>
  );
}
