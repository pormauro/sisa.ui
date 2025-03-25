// app/cash_boxes/CashBoxItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import CircleImagePicker from '../../src/components/CircleImagePicker';

/**
 * item: datos de la caja
 * expanded: booleano para mostrar detalles
 * onToggle, onDelete, onEdit: callbacks para acciones
 */
export default function CashBoxItem({ item, expanded, onToggle, onDelete, onEdit }) {
  const handleToggle = () => {
    onToggle(item.id);
  };

  // Tamaño del avatar según estado expandido
  const avatarSize = expanded ? 80 : 50;

  return (
    <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
      <View style={styles.itemContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.boxName}>{item.name}</Text>
          <CircleImagePicker
            fileId={item.image_file_id}
            editable={false}
            size={avatarSize}
          />
        </View>
        {expanded && (
          <>
            {/* Puedes mostrar aquí más detalles si los tuvieras */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={() => onEdit(item.id)}>
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() =>
                  Alert.alert(
                    'Confirmar',
                    '¿Estás seguro de eliminar esta caja?',
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
  boxName: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
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
