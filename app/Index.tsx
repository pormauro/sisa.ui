import React from 'react';
import { StyleSheet, Image } from 'react-native';

import { ThemedView } from '@/components/ThemedView';

export default function SplashScreen() {
  return (
    <ThemedView style={styles.container}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '90%',
    resizeMode: 'contain',
  },
});
