import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
// <-- IMPORTAMOS BASE_URL
import { BASE_URL } from '../../src/config/index';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    try {
      // USAMOS BASE_URL
      const response = await fetch(`${BASE_URL}/forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Éxito', result.message || 'Email de recuperación enviado');
        router.replace('./login');
      } else {
        Alert.alert('Error', result.error || 'Error al enviar la solicitud');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Ingresa tu email"
        style={styles.input}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <Button title="Enviar recuperación" onPress={handleForgotPassword} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
});
