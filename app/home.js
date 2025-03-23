import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function Menu () {
  const router = useRouter();

  // Define las secciones del sistema; en este ejemplo "Perfil y Configuración" es una sola sección.
  const menuItems = [
    { title: 'Dashboard', route: './dashboard' },
    { title: 'Clientes', route: './clients/ClientsScreen' },
    { title: 'Productos / Servicios', route: './products' },
    { title: 'Carpetas', route: './folders' },
    { title: 'Trabajos', route: './jobs' },
    { title: 'Ventas', route: './sales' },
    { title: 'Gastos', route: './expenses' },
    { title: 'Citas', route: './appointments' },
    { title: 'Notificaciones', route: './notifications' },
    { title: 'Cajas de Dinero', route: './cashboxes' },
    { title: 'Cierres Contables', route: './accounting_closings' },
    { title: 'Perfil', route: './ProfileScreen' },
    { title: 'Configuración', route: './ConfigScreen' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Menú Principal</Text>
      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.menuItem}
          onPress={() => router.push(item.route)}
        >
          <Text style={styles.menuText}>{item.title}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f2f2f2'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  menuItem: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center'
  },
  menuText: {
    color: 'white',
    fontSize: 18,
  }
});
