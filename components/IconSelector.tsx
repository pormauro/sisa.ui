import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColor } from '@/hooks/useThemeColor';
import { resolvePaymentTemplateIcon } from '@/utils/paymentTemplateIcons';
import { PaymentTemplateIconOption } from '@/constants/paymentTemplateIconOptions';

interface IconSelectorProps {
  options: PaymentTemplateIconOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const normalizeValue = (value?: string | null): string | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const IconSelector: React.FC<IconSelectorProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Elegí un icono',
  allowClear = true,
  disabled = false,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedValue = normalizeValue(value);
  const selectedOption = useMemo(
    () => options.find(option => option.value === normalizedValue) ?? null,
    [options, normalizedValue],
  );

  const clearButtonColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#b8b8b8' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const surfaceColor = useThemeColor({ light: '#ffffff', dark: '#2e2640' }, 'background');
  const tintColor = useThemeColor({}, 'button');
  const tintTextColor = useThemeColor({}, 'buttonText');

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter(option => {
      if (option.label.toLowerCase().includes(query)) {
        return true;
      }
      if (option.value.toLowerCase().includes(query)) {
        return true;
      }
      return option.keywords?.some(keyword => keyword.toLowerCase().includes(query));
    });
  }, [options, searchTerm]);

  const resolvedIconName = selectedOption
    ? selectedOption.icon
    : normalizedValue
    ? resolvePaymentTemplateIcon(normalizedValue)
    : null;

  const resolvedLabel = selectedOption
    ? selectedOption.label
    : normalizedValue
    ? `Icono personalizado (${normalizedValue})`
    : null;

  const openModal = () => {
    if (disabled) {
      return;
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchTerm('');
  };

  const handleSelect = (nextValue: string | null) => {
    onChange?.(normalizeValue(nextValue));
    closeModal();
  };

  return (
    <View style={style}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openModal}
        disabled={disabled}
        style={[styles.selectorButton, { borderColor, backgroundColor: surfaceColor }, disabled && styles.disabledButton]}
      >
        {resolvedIconName ? (
          <View style={styles.selectedContent}>
            <Ionicons
              name={resolvedIconName}
              size={26}
              color={selectedOption ? tintColor : textColor}
              style={styles.selectedIcon}
            />
            <View style={styles.selectedLabels}>
              <Text style={[styles.selectedLabel, { color: textColor }]}>{resolvedLabel}</Text>
              <Text style={[styles.selectedValue, { color: placeholderColor }]}>{
                selectedOption ? selectedOption.value : normalizedValue
              }</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholder, { color: placeholderColor }]}>{placeholder}</Text>
        )}
      </TouchableOpacity>

      {allowClear && normalizedValue ? (
        <TouchableOpacity
          onPress={() => handleSelect(null)}
          style={[styles.clearButton, { borderColor: clearButtonColor }]}
          accessibilityLabel="Quitar icono"
        >
          <Ionicons name="close-circle-outline" size={20} color={clearButtonColor} />
          <Text style={[styles.clearButtonText, { color: clearButtonColor }]}>Sin icono</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: surfaceColor }]}> 
                <Text style={[styles.modalTitle, { color: textColor }]}>Elegí un icono para la plantilla</Text>
                <TextInput
                  placeholder="Buscar icono..."
                  placeholderTextColor={placeholderColor}
                  style={[styles.searchInput, { borderColor, color: textColor }]}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />

                {allowClear ? (
                  <TouchableOpacity
                    style={[styles.modalClearButton, { borderColor }]}
                    onPress={() => handleSelect(null)}
                  >
                    <Ionicons name="close-circle" size={20} color={clearButtonColor} style={styles.modalClearIcon} />
                    <Text style={[styles.modalClearText, { color: textColor }]}>Usar icono predeterminado</Text>
                  </TouchableOpacity>
                ) : null}

                <FlatList
                  data={filteredOptions}
                  keyExtractor={item => item.value}
                  numColumns={3}
                  columnWrapperStyle={styles.columnWrapper}
                  contentContainerStyle={styles.gridContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isSelected = item.value === normalizedValue;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          { borderColor },
                          isSelected && { backgroundColor: tintColor, borderColor: tintColor },
                        ]}
                        onPress={() => handleSelect(item.value)}
                      >
                        <Ionicons
                          name={item.icon}
                          size={28}
                          color={isSelected ? tintTextColor : textColor}
                        />
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: isSelected ? tintTextColor : textColor },
                          ]}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search" size={28} color={placeholderColor} />
                      <Text style={[styles.emptyText, { color: placeholderColor }]}>Sin resultados</Text>
                    </View>
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
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  placeholder: {
    fontSize: 16,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIcon: {
    marginRight: 12,
  },
  selectedLabels: {
    flexShrink: 1,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedValue: {
    marginTop: 2,
    fontSize: 13,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  modalClearButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalClearIcon: {
    marginRight: 8,
  },
  modalClearText: {
    fontSize: 15,
    fontWeight: '600',
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  gridContent: {
    paddingBottom: 12,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  optionLabel: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
});

export default IconSelector;
