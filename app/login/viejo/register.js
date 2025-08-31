import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, StyleSheet, TextInput, View } from 'react-native';
// <-- IMPORTAMOS BASE_URL
import { BASE_URL } from '../../../src/config/index';

export default function Register () {
  const router = useRouter();
  const [username, setUsername] = useState('pormauro');
  const [email, setEmail] = useState('pormauro@gmail.com');
  const [password, setPassword] = useState('123456');

  const isValidPassword = (password) => {
    return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };
  const handleRegister = async () => {
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.');
      return;
    }
    
    if (!username || !email || !password) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }
    try {
      // USAMOS BASE_URL
      const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert(
          'Éxito',
          result.message || 'Usuario registrado. Revisa tu email para activar la cuenta.'
        );
        router.replace('./login');
      } else {
        Alert.alert('Error', result.error || 'Error en el registro');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Nombre de usuario"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        placeholder="Correo electrónico"
        style={styles.input}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Registrar" onPress={handleRegister} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
});
