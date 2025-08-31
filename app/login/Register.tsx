import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/config/Index';
import globalStyles from '@/styles/GlobalStyles';

const Register: React.FC = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValidPassword = (password: string): boolean => {
    return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.');
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Éxito', result.message || 'Usuario registrado. Revisa tu email para activar la cuenta.');
        router.back();
      } else {
        Alert.alert('Error', result.error || 'Error en el registro');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={globalStyles.container}>
      <TextInput
        placeholder="Nombre de usuario"
        style={globalStyles.input}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        placeholder="Correo electrónico"
        style={globalStyles.input}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <View style={globalStyles.passwordContainer}>
        <TextInput
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          style={[globalStyles.input, globalStyles.passwordInput]}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          onPress={() => setShowPassword(prev => !prev)}
          style={globalStyles.eyeIcon}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>
      <View style={globalStyles.button}>
        <Button title="Registrar" onPress={handleRegister} />
      </View>

    </View>
  );
};

export default Register;
