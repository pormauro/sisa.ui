import React, { useState, useContext } from 'react';
import { View, TextInput, Button, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import globalStyles from '@/styles/GlobalStyles';

const Login: React.FC = () => {
  const { login } = useContext(AuthContext);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Ingresa username y contraseña');
      return;
    }
    await login(username, password);
    router.replace('./');
  };

  return (
    <View style={globalStyles.container}>
      <TextInput
        style={globalStyles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <View style={localStyles.passwordContainer}>
        <TextInput
          style={[globalStyles.input, localStyles.passwordInput]}
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          onPress={() => setShowPassword(prev => !prev)}
          style={localStyles.eyeIcon}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>
      <View style={globalStyles.button}>
        <Button title="Ingresar" onPress={handleLogin} />
      </View>
      <View style={globalStyles.button}>
        <Button title="Registrarse" onPress={() => router.push('/login/Register')} />
      </View>
      <View style={globalStyles.button}>
        <Button title="Olvidé mi contraseña" onPress={() => router.push('/login/ForgotPassword')} />
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
  },
});

export default Login;
