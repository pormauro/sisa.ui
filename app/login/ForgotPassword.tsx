// app/login/ForgotPassword.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/config/Index';
import globalStyles from '@/styles/GlobalStyles';

const ForgotPassword: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Éxito', result.message || 'Email de recuperación enviado');
        router.back();
      } else {
        Alert.alert('Error', result.error || 'Error al enviar la solicitud');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={globalStyles.container}>
      <TextInput
        placeholder="Ingresa tu email"
        style={globalStyles.input}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <Button title="Enviar recuperación" onPress={handleForgotPassword} />
    </View>
  );
};

export default ForgotPassword;
