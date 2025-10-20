import React, { useCallback, useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { ModalPicker, ModalPickerItem } from './ModalPicker';

export interface SearchableSelectItem {
  label: string;
  value: string | number;
  imageFileId?: string | null;
  backgroundColor?: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  selectedValue?: string | number | null;
  onValueChange?: (itemValue: string | number | null, itemIndex: number) => void;
  onItemChange?: (item: SearchableSelectItem, itemIndex: number) => void;
  onItemLongPress?: (item: SearchableSelectItem, itemIndex: number) => void;
  placeholder?: string;
  enabled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  showSearch?: boolean;
  hasError?: boolean;
  errorColor?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  items,
  selectedValue = null,
  onValueChange,
  onItemChange,
  onItemLongPress,
  placeholder = 'Selecciona una opción',
  enabled = true,
  disabled,
  style,
  showSearch = true,
  hasError = false,
  errorColor,
}) => {
  const normalizedSelectedValue =
    selectedValue === null || typeof selectedValue === 'undefined'
      ? null
      : String(selectedValue);

  const modalItems = useMemo<ModalPickerItem[]>(
    () =>
      items.map(({ label, value, imageFileId, backgroundColor }) => ({
        id: value,
        name: label,
        imageFileId: imageFileId ?? undefined,
        backgroundColor,
      })),
    [items]
  );

  const valueIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, index) => {
      map.set(String(item.value), index);
    });
    return map;
  }, [items]);

  const selectedItem = useMemo(() => {
    if (normalizedSelectedValue === null) {
      return null;
    }
    const index = valueIndexMap.get(normalizedSelectedValue);
    return typeof index === 'number' ? modalItems[index] ?? null : null;
  }, [modalItems, normalizedSelectedValue, valueIndexMap]);

  const handleSelect = useCallback(
    (modalItem: ModalPickerItem) => {
      const key = String(modalItem.id);
      const index = valueIndexMap.get(key);
      const item = typeof index === 'number' ? items[index] : undefined;
      const nextValue = item ? item.value : (modalItem.id as string | number | null);

      if (onValueChange) {
        onValueChange(nextValue ?? null, typeof index === 'number' ? index : -1);
      }

      if (item && onItemChange) {
        onItemChange(item, index!);
      }
    },
    [items, onItemChange, onValueChange, valueIndexMap]
  );

  const handleItemLongPress = useCallback(
    (modalItem: ModalPickerItem) => {
      if (!onItemLongPress) {
        return;
      }

      const key = String(modalItem.id);
      const index = valueIndexMap.get(key);
      if (typeof index === 'number') {
        onItemLongPress(items[index], index);
        return;
      }

      onItemLongPress(
        {
          label: modalItem.name,
          value: modalItem.id,
          imageFileId: modalItem.imageFileId,
          backgroundColor: modalItem.backgroundColor,
        },
        -1
      );
    },
    [items, onItemLongPress, valueIndexMap]
  );

  const isDisabled = typeof disabled === 'boolean' ? disabled : !enabled;

  return (
    <View style={style}>
      <ModalPicker
        items={modalItems}
        selectedItem={selectedItem ?? undefined}
        onSelect={handleSelect}
        placeholder={placeholder}
        disabled={isDisabled}
        onItemLongPress={onItemLongPress ? handleItemLongPress : undefined}
        showSearch={showSearch}
        hasError={hasError}
        errorColor={errorColor}
      />
    </View>
  );
};

export default SearchableSelect;
