import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface MenuItem {
  title: string;
  route: string;
  // Si no se especifica, se asume que la sección siempre está habilitada.
  requiredPermissions?: string[];
}

const menuItems: MenuItem[] = [
  { title: 'Clientes', route: '/clients', requiredPermissions: ['listClients'] },
  { title: 'Trabajos', route: '/jobs', requiredPermissions: ['listJobs'] },
  { title: 'Cajas', route: '/cash_boxes', requiredPermissions: ['listCashBoxes'] },
  { title: 'Recibos', route: '/receipts', requiredPermissions: ['listReceipts'] },
  { title: 'Pagos', route: '/payments', requiredPermissions: ['listPayments'] },
  { title: 'Carpetas', route: '/folders', requiredPermissions: ['listFolders'] },
  { title: 'Tarifas', route: '/tariffs', requiredPermissions: ['listTariffs'] },
  { title: 'Proveedores', route: '/providers', requiredPermissions: ['listProviders'] },
  { title: 'Categorías', route: '/categories', requiredPermissions: ['listCategories'] },
  { title: 'Estados', route: '/statuses', requiredPermissions: ['listStatuses'] },
  { title: 'Perfil', route: '/user/ProfileScreen' },
  { title: 'Config', route: '/user/ConfigScreen' },
  { title: 'Permisos', route: '/permission', requiredPermissions: ['listPermissions'] },
];

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  // Función para determinar si se deben mostrar los elementos con permisos requeridos.
  const isEnabled = (item: MenuItem): boolean => {
    // Si el usuario es super, se muestran todos.
    if (userId === '1') return true;
    // Si no hay permisos requeridos, se muestra.
    if (!item.requiredPermissions) return true;
    // De lo contrario, se verifica que el usuario tenga todos los permisos requeridos.
    return item.requiredPermissions.every((perm) => permissions.includes(perm));
  };

  // Filtramos el array de elementos para mostrar solo los habilitados.
  const visibleMenuItems = menuItems.filter(isEnabled);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Menú Principal</Text>
        {visibleMenuItems.map((item: MenuItem, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Menu;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  container: {
    padding: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  menuText: {
    color: 'white',
    fontSize: 18,
  },
});
