import React from 'react';
import { Stack } from 'expo-router';

export default function LoginLayout() {
  return (
    <Stack>
      <Stack.Screen name="Login" options={{ title: 'Iniciar Sesión' }} />
      <Stack.Screen name="Register" options={{ title: 'Registrate' }} />
      <Stack.Screen name="ForgotPassword" options={{ title: 'Recuperar Contraseña' }} />
    </Stack>
  );
}
