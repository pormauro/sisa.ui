import { AuthContext } from '@/contexts/AuthContext';
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image 
        source={require('@/assets/images/logo.png')} 
        style={styles.logo} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2f273e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '90%',
    resizeMode: 'contain',
  },
});
