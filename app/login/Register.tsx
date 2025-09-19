import React, { useState } from 'react';
import { Button, Alert, TouchableOpacity, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/config/Index';
import globalStyles from '@/styles/GlobalStyles';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const Register: React.FC = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const iconColor = useThemeColor({ light: '#666', dark: '#ddd' }, 'text');

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
    <ThemedView style={[globalStyles.container, { backgroundColor }]}>
      <TextInput
        placeholder="Nombre de usuario"
        style={[globalStyles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={username}
        onChangeText={setUsername}
        placeholderTextColor={placeholderColor}
      />
      <TextInput
        placeholder="Correo electrónico"
        style={[globalStyles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholderTextColor={placeholderColor}
      />
      <View style={globalStyles.passwordContainer}>
        <TextInput
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          style={[globalStyles.input, globalStyles.passwordInput, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(prev => !prev)}
          style={globalStyles.eyeIcon}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={iconColor} />
        </TouchableOpacity>
      </View>
      <View style={globalStyles.button}>
        <Button title="Registrar" onPress={handleRegister} />
      </View>

    </ThemedView>
  );
};

export default Register;
