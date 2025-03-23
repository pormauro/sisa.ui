import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// <-- IMPORTAMOS BASE_URL
import { BASE_URL } from '../../src/config/index';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('pormauro');
  const [password, setPassword] = useState('123456');

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Ingresa username y contraseña');
      return;
    }
    try {
      // USAMOS BASE_URL
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const authHeader = response.headers.get('Authorization');
        const token = authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.split(' ')[1]
          : null;

        if (token) {
          // Guardamos el token en AsyncStorage
          await AsyncStorage.setItem('token', token);

          // Solicitar el perfil del usuario para guardar sus datos
          const profileResponse = await fetch(`${BASE_URL}/profile`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            const { id, username: userName, email } = profileData.user;
            await AsyncStorage.setItem('user_id', id.toString());
            await AsyncStorage.setItem('username', userName);
            await AsyncStorage.setItem('email', email);

            // Redirigir a Home
            router.replace('../home');
          } else {
            Alert.alert('Error', 'No se pudo obtener el perfil del usuario');
          }
        } else {
          Alert.alert('Error', 'Token no recibido en el encabezado');
        }
      } else {
        const result = await response.json();
        Alert.alert('Error', result.error || 'Credenciales inválidas');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Username"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Ingresar" onPress={handleLogin} />
      <Button title="Registrarse" onPress={() => router.push('./register')} />
      <Button title="Olvidé mi contraseña" onPress={() => router.push('./forgot-password')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
});
