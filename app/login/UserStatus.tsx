// app/login/EstadoUsuario.tsx
import React, { useContext } from 'react';
import { View, Text, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';

const EstadoUsuario: React.FC = () => {
  const { userId, isLoading, logout } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {userId ? (
        <>
          <Text style={styles.text}>Bienvenido, tu ID de usuario es: {userId}</Text>
          <Button title="Cerrar sesión" onPress={logout} />
        </>
      ) : (
        <Text style={styles.text}>No hay usuario autenticado</Text>
      )}
    </View>
  );
};

export default EstadoUsuario;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
  },
});
