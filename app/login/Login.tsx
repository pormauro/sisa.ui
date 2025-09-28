import React, { useState, useContext, useEffect } from 'react';
import { Button, Alert, TouchableOpacity, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import globalStyles from '@/styles/GlobalStyles';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const Login: React.FC = () => {
  const { login, username: loggedUsername } = useContext(AuthContext);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const iconColor = useThemeColor({ light: '#666', dark: '#ddd' }, 'text');

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Ingresa username y contraseña');
      return;
    }
    await login(username, password);
  };

  useEffect(() => {
    if (loggedUsername) {
      router.replace('/Home');
    }
  }, [loggedUsername, router]);

  return (
    <ThemedView style={[globalStyles.container, { backgroundColor }]}>
      <TextInput
        style={[globalStyles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        placeholderTextColor={placeholderColor}
      />
      <View style={localStyles.passwordContainer}>
        <TextInput
          style={[globalStyles.input, localStyles.passwordInput, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(prev => !prev)}
          style={localStyles.eyeIcon}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={iconColor} />
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
    </ThemedView>
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
