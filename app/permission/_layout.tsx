import React from 'react';
import { Stack } from 'expo-router';

export default function PermissionLayout() {
  return (
    <Stack>
      <Stack.Screen name="PermissionScreen" />
    </Stack>
  );
}
