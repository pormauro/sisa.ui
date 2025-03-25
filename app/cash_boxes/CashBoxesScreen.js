// app/cash_boxes/CashBoxesScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CashBoxesList from './CashBoxesList';

export default function CashBoxesScreen() {
  const router = useRouter();

  const handleAddCashBox = () => {
    router.push('./AddCashBox');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cajas de Dinero</Text>
      <CashBoxesList />
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddCashBox}>
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
    textAlign: 'center'
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
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  floatingButtonText: {
    fontSize: 30,
    color: '#fff',
    marginTop: -4,
  },
});
