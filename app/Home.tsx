import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface MenuItem {
  title: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  // Si no se especifica, se asume que la sección siempre está habilitada.
  requiredPermissions?: string[];
}

const menuItems: MenuItem[] = [
  { title: 'Recibos', route: '/receipts', icon: 'receipt', requiredPermissions: ['listReceipts'] },
  { title: 'Pagos', route: '/payments', icon: 'card', requiredPermissions: ['listPayments'] },
  { title: 'Clientes', route: '/clients', icon: 'people', requiredPermissions: ['listClients'] },
  { title: 'Proveedores', route: '/providers', icon: 'cart', requiredPermissions: ['listProviders'] },
  { title: 'Trabajos', route: '/jobs', icon: 'briefcase', requiredPermissions: ['listJobs'] },
  { title: 'Tarifas', route: '/tariffs', icon: 'pricetag', requiredPermissions: ['listTariffs'] },
  { title: 'Carpetas', route: '/folders', icon: 'folder', requiredPermissions: ['listFolders'] },
  { title: 'Cajas', route: '/cash_boxes', icon: 'cash', requiredPermissions: ['listCashBoxes'] },
  { title: 'Categorías', route: '/categories', icon: 'list', requiredPermissions: ['listCategories'] },
  { title: 'Estados', route: '/statuses', icon: 'flag', requiredPermissions: ['listStatuses'] },
  { title: 'Perfil', route: '/user/ProfileScreen', icon: 'person' },
  { title: 'Configuración', route: '/user/ConfigScreen', icon: 'settings' },
  { title: 'Cola', route: '/sync_queue', icon: 'sync' },
  { title: 'Permisos', route: '/permission', icon: 'lock-closed', requiredPermissions: ['listPermissions'] },
];

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  // Función para determinar si se deben mostrar los elementos con permisos requeridos.
  const isEnabled = (item: MenuItem): boolean => {
    // El botón de permisos siempre está disponible para el usuario maestro.
    if (item.route === '/permission' && userId === '1') return true;
    // Si no hay permisos requeridos, se muestra.
    if (!item.requiredPermissions) return true;
    // De lo contrario, se verifica que el usuario tenga todos los permisos requeridos.
    return item.requiredPermissions.every((perm) => permissions.includes(perm));
  };

  // Filtramos el array de elementos para mostrar solo los habilitados.
  const visibleMenuItems = menuItems.filter(isEnabled);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }] }>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={styles.title}>Menú Principal</ThemedText>
        <View style={styles.menuContainer}>
          {visibleMenuItems.map((item: MenuItem, index: number) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { backgroundColor: tintColor }]}
              onPress={() => router.push(item.route as any)}
            >
              <Ionicons name={item.icon} size={40} color={textColor} style={styles.menuIcon} />
              <ThemedText style={styles.menuText}>{item.title}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Menu;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  menuIcon: {
    marginBottom: 5,
  },
  menuText: {
    fontSize: 18,
    textAlign: 'center',
  },
});
