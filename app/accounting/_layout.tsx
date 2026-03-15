import React from 'react';
import { Stack } from 'expo-router';

export default function AccountingLayout() {
  return (
    <Stack>
      <Stack.Screen name="summary" options={{ title: 'Resumen contable' }} />
    </Stack>
  );
}
