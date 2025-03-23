// app/clients/ClientItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import CircleImagePicker from '../../src/components/CircleImagePicker';

/**
 * item: datos del cliente
 * expanded: bool para controlar expandido
 * onToggle, onDelete, onEdit: callbacks
 */
export default function ClientItem({ item, expanded, onToggle, onDelete, onEdit }) {

  const handleToggle = () => {
    onToggle(item.id);
  };

  // Ajusta un tamaño más chico, por ejemplo 50
  const avatarSize = expanded ? 80 : 50;

  return (
    <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
      <View style={styles.itemContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.companyName}>{item.business_name}</Text>

          {/* Usa CircleImagePicker en modo lectura (editable={false}). 
              Carga la imagen a partir de brand_file_id */}
          <CircleImagePicker
            fileId={item.brand_file_id}
            editable={false}
            size={avatarSize}
          />
        </View>

        {expanded && (
          <>
            <Text style={styles.itemText}>CUIT: {item.tax_id}</Text>
            <Text style={styles.itemText}>Email: {item.email}</Text>
            <Text style={styles.itemText}>Dirección: {item.address}</Text>
            <Text style={styles.itemText}>Teléfono: {item.phone}</Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={() => onEdit(item.id)}>
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() =>
                  Alert.alert(
                    'Confirmar',
                    '¿Estás seguro de eliminar este cliente?',
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
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  itemText: {
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
