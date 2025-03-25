// app/products_services/ProductServiceItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import CircleImagePicker from '../../src/components/CircleImagePicker';

/**
 * Props:
 * - item: Objeto con los datos del producto/servicio.
 * - expanded: Booleano para controlar la expansión.
 * - onToggle, onDelete, onEdit: callbacks.
 */
export default function ProductServiceItem({ item, expanded, onToggle, onDelete, onEdit }) {
  const handleToggle = () => {
    onToggle(item.id);
  };

  // Tamaño del avatar según el estado expandido
  const avatarSize = expanded ? 80 : 50;

  return (
    <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
      <View style={styles.itemContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <CircleImagePicker
            fileId={item.product_image_file_id}
            editable={false}
            size={avatarSize}
          />
        </View>
        {expanded && (
          <>
            <Text style={styles.itemDetail}>Categoría: {item.category || '-'}</Text>
            <Text style={styles.itemDetail}>Precio: ${item.price}</Text>
            <Text style={styles.itemDetail}>Costo: ${item.cost || '-'}</Text>
            <Text style={styles.itemDetail}>Dificultad: {item.difficulty || '-'}</Text>
            <Text style={styles.itemDetail}>Tipo: {item.item_type}</Text>
            <Text style={styles.itemDetail}>Stock: {item.stock}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={() => onEdit(item.id)}>
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() =>
                  Alert.alert(
                    'Confirmar',
                    '¿Estás seguro de eliminar este producto/servicio?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: () => onDelete(item.id),
                      },
                    ]
                  )
                }
              >
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    width: '100%',
    backgroundColor: '#E2E2FA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDescription: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  itemDetail: {
    fontSize: 16,
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF3333',
    marginRight: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
