// app/components/ModalPicker.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

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
  onItemLongPress?: (item: ModalPickerItem) => void;
  showSearch?: boolean;
  hasError?: boolean;
  errorColor?: string;
}

export const ModalPicker: React.FC<ModalPickerProps> = ({
  items,
  selectedItem = null,
  onSelect,
  placeholder = "Selecciona un ítem",
  disabled = false,
  onItemLongPress,
  showSearch = true,
  hasError = false,
  errorColor,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const longPressHandledRef = useRef(false);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#aaa' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const errorBorderColor = useThemeColor({ light: '#ef4444', dark: '#fca5a5' }, 'text');

  const resolvedBorderColor = hasError ? errorColor ?? errorBorderColor : borderColor;
  const resolvedPlaceholderColor = hasError ? errorColor ?? errorBorderColor : placeholderColor;

  // Si se pasa el objeto completo se usa; si no, se intenta hallar a partir de selectedValue (si fuera necesario)
  const computedSelectedItem = useMemo(() => {
    return selectedItem;
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    if (!showSearch) {
      return items;
    }

    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return items;
    }

    return items.filter((item) =>
      item.name.toLowerCase().includes(normalizedTerm)
    );
  }, [items, searchTerm, showSearch]);

  useEffect(() => {
    if (!modalVisible) {
      setSearchTerm('');
    }
  }, [modalVisible]);

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSelect = (item: ModalPickerItem) => {
    onSelect(item);
    closeModal();
  };

  const handleItemPress = (item: ModalPickerItem) => {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      return;
    }
    handleSelect(item);
  };

  const handleItemLongPress = (item: ModalPickerItem) => {
    if (!onItemLongPress) {
      return;
    }
    longPressHandledRef.current = true;
    closeModal();
    onItemLongPress(item);
  };

  return (
    <View>
      {/* Botón que muestra el elemento seleccionado (con el fondo coloreado si aplica) o el placeholder */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          { borderColor: resolvedBorderColor, backgroundColor },
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
              { color: textColor },
              computedSelectedItem.backgroundColor ? { color: '#fff' } : {},
            ]}
          >
            {computedSelectedItem.name}
          </Text>
        ) : (
          <Text style={[styles.placeholderText, { color: resolvedPlaceholderColor }]}>
            {placeholder}
          </Text>
        )}
      </TouchableOpacity>

      {/* Modal con la lista de opciones */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContainer, { backgroundColor }]}>
                {showSearch && (
                  <View style={styles.searchContainer}>
                    <TextInput
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      placeholder="Buscar..."
                      placeholderTextColor={placeholderColor}
                      style={[
                        styles.searchInput,
                        { color: textColor, borderColor, backgroundColor },
                      ]}
                    />
                  </View>
                )}
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: textColor }]}>
                        Sin resultados
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.itemContainer,
                        {
                          backgroundColor: item.backgroundColor || backgroundColor,
                          borderBottomColor: borderColor,
                        },
                      ]}
                      onPress={() => handleItemPress(item)}
                      onLongPress={() => handleItemLongPress(item)}
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
                          { color: item.backgroundColor ? '#fff' : textColor },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  emptyContainer: {
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
