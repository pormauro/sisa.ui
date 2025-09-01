import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

interface MenuItem {
  title: string;
  route: string;
  // Si no se especifica, se asume que la sección siempre está habilitada.
  requiredPermissions?: string[];
}

const menuItems: MenuItem[] = [
  { title: 'Cajas', route: '/cash_boxes', requiredPermissions: ['listCashBoxes'] },
  { title: 'Recibos', route: '/receipts', requiredPermissions: ['listReceipts'] },
  { title: 'Pagos', route: '/payments', requiredPermissions: ['listPayments'] },
  { title: 'Clientes', route: '/clients', requiredPermissions: ['listClients'] },
  { title: 'Proveedores', route: '/providers', requiredPermissions: ['listProviders'] },
  { title: 'Categorías', route: '/categories', requiredPermissions: ['listCategories'] },
  { title: 'Trabajos', route: '/jobs', requiredPermissions: ['listJobs'] },
  { title: 'Citas', route: '/appointments', requiredPermissions: ['listAppointments'] },
 // { title: 'Notificaciones', route: '/notifications' }, // Sin restricción
  { title: 'Cierres Contables', route: '/accounting_closings', requiredPermissions: ['listClosings'] },
  { title: 'Perfil', route: '/user/ProfileScreen' }, // Sin restricción
  { title: 'Configuración', route: '/user/ConfigScreen' }, // Sin restricción
  { title: 'Productos / Servicios', route: '/products_services', requiredPermissions: ['listProductsServices'] },
  { title: 'Carpetas', route: '/folders', requiredPermissions: ['listFolders'] },
  { title: 'Estados', route: '/statuses', requiredPermissions: ['listStatuses'] },
  { title: 'Tarifas', route: '/tariffs', requiredPermissions: ['listTariffs'] },
  { title: 'Errors', route: '/ErrorLogsList', requiredPermissions: ['viewErrors'] },
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
    <ScrollView style={styles.container}>
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
      <View>
        <Text></Text>
      </View>
    </ScrollView>
  );
};

export default Menu;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f2f2f2',
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
