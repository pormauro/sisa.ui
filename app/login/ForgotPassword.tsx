// app/login/ForgotPassword.tsx
import React, { useState } from 'react';
import { Button, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/config/Index';
import globalStyles from '@/styles/GlobalStyles';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const ForgotPassword: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const backgroundColor = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

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
    <ThemedView style={[globalStyles.container, { backgroundColor }]}>
      <TextInput
        placeholder="Ingresa tu email"
        style={[globalStyles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholderTextColor={placeholderColor}
      />
      <Button title="Enviar recuperación" onPress={handleForgotPassword} />
    </ThemedView>
  );
};

export default ForgotPassword;
