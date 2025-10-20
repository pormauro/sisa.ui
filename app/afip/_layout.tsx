import React from 'react';
import { Stack } from 'expo-router';

export default function AfipLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="points-of-sale" />
    </Stack>
  );
}
