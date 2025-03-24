import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ClientList from './clientList';
import { useRouter } from 'expo-router';

export default function ClientsScreen() {
  const [selectedClient, setSelectedClient] = useState(null);
  const router = useRouter();

  //console.log(selectedClient.id);

  const handleAddClient = () => {
    router.push('./AddClient');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lista de Clientes</Text>
      <ClientList onSelectedClient={setSelectedClient} />
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddClient}>
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 10,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007BFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para Android e iOS
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  floatingButtonText: {
    fontSize: 30,
    color: '#fff',
    marginTop: -4, // Ajuste fino para centrar el '+'
  },
});
