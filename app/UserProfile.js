// UserProfile.js
import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { UserContext } from '../src/contexts/UserContext';

const UserProfile = () => {
  const { user, setUser } = useContext(UserContext);

  // Función para actualizar la información del usuario
  const updateUser = () => {
    setUser({
      id: 2,
      username: 'jane_doe',
      email: 'jane@example.com',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username: {user.username}</Text>
      <Text style={styles.label}>Email: {user.email}</Text>
      <Button title="Update User" onPress={updateUser} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    alignItems: 'center' 
  },
  label: { 
    fontSize: 16, 
    marginBottom: 10 
  },
});

export default UserProfile;
