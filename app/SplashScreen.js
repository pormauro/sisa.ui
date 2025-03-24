import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Linking, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logo from '../assets/images/logo.png';
// <-- IMPORTAMOS BASE_URL
import { BASE_URL } from '../src/config/index';




export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkProfile = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          // USAMOS BASE_URL
          const response = await fetch(`${BASE_URL}/profile`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            // Extraemos los datos del usuario
            const { id, username, email } = data.user;
            // Guardamos en AsyncStorage
            await AsyncStorage.setItem('user_id', id.toString());
            await AsyncStorage.setItem('username', username);
            await AsyncStorage.setItem('email', email);

            router.replace('./home');
          } else {
            await AsyncStorage.removeItem('token');
            router.replace('./login/login');
          }
        } catch (error) {
          console.log('Error:', error);
          await AsyncStorage.removeItem('token');
          router.replace('./login/login');
        }
      } else {
        router.replace('./login/login');
      }
    };

    setTimeout(checkProfile, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sistema de Gestión</Text>
      <Image source={logo} style={styles.logo} />

      <TouchableOpacity onPress={() => Linking.openURL('https://www.privacypolicies.com/live/a987d28b-ea26-4d75-97fb-3518c54598b0')}>
        <Text style={{ color: 'blue' }}>Política de Privacidad</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2f273e', // Color de fondo
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20,
    color:'#ffffff'
  },
  logo: {
    width: '90%',
    resizeMode: 'contain',
  },
});