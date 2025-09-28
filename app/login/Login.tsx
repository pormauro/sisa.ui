import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const passwordInputRef = useRef<TextInput | null>(null);

  const backgroundColor = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const iconColor = useThemeColor({ light: '#666', dark: '#ddd' }, 'text');
  const primaryButtonBackground = useThemeColor({}, 'button');
  const primaryButtonTextColor = useThemeColor({}, 'buttonText');
  const secondaryColor = useThemeColor({}, 'tint');
  const secondaryBackground = useThemeColor(
    { light: 'transparent', dark: 'rgba(255, 255, 255, 0.12)' },
    'background'
  );

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
    <ThemedView style={[globalStyles.container, localStyles.screen, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={localStyles.formWrapper}
      >
        <View style={localStyles.form}>
          <TextInput
            style={[
              globalStyles.input,
              localStyles.input,
              { backgroundColor: inputBackground, color: inputTextColor, borderColor },
            ]}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <View style={localStyles.passwordContainer}>
            <TextInput
              ref={passwordInputRef}
              style={[
                globalStyles.input,
                localStyles.passwordInput,
                { backgroundColor: inputBackground, color: inputTextColor, borderColor },
              ]}
              placeholder="Contraseña"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              style={({ pressed }) => [localStyles.eyeIcon, pressed && localStyles.eyeIconPressed]}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={iconColor} />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              localStyles.primaryButton,
              {
                backgroundColor: primaryButtonBackground,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={handleLogin}
            accessibilityRole="button"
          >
            <Text style={[localStyles.primaryButtonText, { color: primaryButtonTextColor }]}>Ingresar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              localStyles.secondaryButton,
              {
                borderColor: secondaryColor,
                backgroundColor: secondaryBackground,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.push('/login/Register')}
            accessibilityRole="button"
          >
            <Text style={[localStyles.secondaryButtonText, { color: secondaryColor }]}>Registrarse</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              localStyles.secondaryButton,
              {
                borderColor: secondaryColor,
                backgroundColor: secondaryBackground,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.push('/login/ForgotPassword')}
            accessibilityRole="button"
          >
            <Text style={[localStyles.secondaryButtonText, { color: secondaryColor }]}>Olvidé mi contraseña</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
};

const localStyles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  formWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  form: {
    width: '100%',
    maxWidth: 420,
    gap: 16,
  },
  input: {
    width: '100%',
  },
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
    padding: 8,
    borderRadius: 20,
  },
  eyeIconPressed: {
    opacity: 0.6,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default Login;
