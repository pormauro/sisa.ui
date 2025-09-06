// C:/Users/Mauri/Documents/GitHub/router/app/products_services/index.tsx
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ProductsServicesContext, ProductService } from '@/contexts/ProductsServicesContext';

export default function ProductsServicesScreen() {
  const { productsServices, loadProductsServices, deleteProductService } = useContext(ProductsServicesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProductService | null>(null);

  useEffect(() => {
    if (!permissions.includes('listProductsServices')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver productos y servicios.');
      router.back();
    } else {
      loadProductsServices();
    }
  }, [permissions]);

  const fuse = new Fuse(productsServices, { keys: ['description', 'category'] });
  const filteredItems = useMemo(() => {
    if (!searchQuery) return productsServices;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, productsServices]);

  const canDelete = permissions.includes('deleteProductService');

  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este ítem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            const success = await deleteProductService(id);
            setLoadingId(null);
            if (!success) {
              Alert.alert('Error', 'No se pudo eliminar el producto/servicio');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: ProductService }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => setSelectedItem(item)}
      onLongPress={() => router.push(`./products_services/${item.id}`)}
    >
      <CircleImagePicker fileId={item.product_image_file_id} size={50} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.description}</Text>
        {/*<Text>{item.category}</Text>*/}
        <Text>${item.price}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar producto o servicio..."
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron registros</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/products_services/create')}>
        <Text style={styles.addButtonText}>➕ Agregar</Text>
      </TouchableOpacity>
      <ItemDetailModal
        visible={selectedItem !== null}
        item={selectedItem}
        fieldLabels={{
          id: 'ID',
          description: 'Descripción',
          category: 'Categoría',
          price: 'Precio',
          cost: 'Costo',
          difficulty: 'Dificultad',
          item_type: 'Tipo',
          stock: 'Stock',
          created_at: 'Fecha de creación',
          updated_at: 'Fecha de edición',
        }}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, backgroundColor: '#28a745', padding: 16, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
