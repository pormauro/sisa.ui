// app/components/ModalPicker.tsx
import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';

export interface ModalPickerItem {
  id: number | string;
  name: string;
  imageFileId?: string | null; // URL o ruta de la imagen (opcional)
  backgroundColor?: string;    // Color de fondo para el ítem (opcional)
}

interface ModalPickerProps {
  items: ModalPickerItem[];
  selectedItem?: ModalPickerItem | null;
  onSelect: (item: ModalPickerItem) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ModalPicker: React.FC<ModalPickerProps> = ({
  items,
  selectedItem = null,
  onSelect,
  placeholder = "Selecciona un ítem",
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Si se pasa el objeto completo se usa; si no, se intenta hallar a partir de selectedValue (si fuera necesario)
  const computedSelectedItem = useMemo(() => {
    return selectedItem;
  }, [selectedItem]);

  const handleSelect = (item: ModalPickerItem) => {
    onSelect(item);
    setModalVisible(false);
  };

  return (
    <View>
      {/* Botón que muestra el elemento seleccionado (con el fondo coloreado si aplica) o el placeholder */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          computedSelectedItem && computedSelectedItem.backgroundColor
            ? { backgroundColor: computedSelectedItem.backgroundColor }
            : {},
          disabled ? { opacity: 0.5 } : {},
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        {computedSelectedItem ? (
          <Text
            style={[
              styles.selectorText,
              computedSelectedItem.backgroundColor ? { color: '#fff' } : {},
            ]}
          >
            {computedSelectedItem.name}
          </Text>
        ) : (
          <Text style={styles.placeholderText}>{placeholder}</Text>
        )}
      </TouchableOpacity>

      {/* Modal con la lista de opciones */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.itemContainer,
                    { backgroundColor: item.backgroundColor || "#fff" },
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  {item.imageFileId && (
                    <Image
                      source={{ uri: item.imageFileId }}
                      style={styles.itemImage}
                    />
                  )}
                  <Text
                    style={[
                      styles.itemText,
                      item.backgroundColor ? { color: '#fff' } : {},
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  selectorButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  selectorText: {
    fontSize: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    maxHeight: '80%',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  itemText: {
    fontSize: 16,
  },
});
