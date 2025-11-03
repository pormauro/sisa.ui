import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { IconName } from '@/constants/menuSections';
import {
  DEFAULT_PAYMENT_TEMPLATE_ICON,
  PAYMENT_TEMPLATE_ICON_OPTIONS,
} from '@/constants/paymentTemplateIcons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';

interface ShortcutIconSelectorProps {
  value?: IconName | null;
  onChange: (icon: IconName) => void;
}

export const ShortcutIconSelector: React.FC<ShortcutIconSelectorProps> = ({ value, onChange }) => {
  const activeColor = useThemeColor({}, 'tint');
  const inactiveColor = useThemeColor({ light: '#d0cde1', dark: '#4b3f5c' }, 'background');
  const backgroundColor = useThemeColor({}, 'background');
  const iconSelectedColor = useThemeColor({ light: '#ffffff', dark: '#1b1330' }, 'text');
  const iconDefaultColor = useThemeColor({}, 'text');

  const selectedIcon = useMemo(() => {
    const normalized = value && PAYMENT_TEMPLATE_ICON_OPTIONS.some(option => option.icon === value)
      ? (value as IconName)
      : DEFAULT_PAYMENT_TEMPLATE_ICON;
    return normalized;
  }, [value]);

  const selectedOption = useMemo(
    () => PAYMENT_TEMPLATE_ICON_OPTIONS.find(option => option.icon === selectedIcon),
    [selectedIcon],
  );

  return (
    <View>
      <View style={styles.grid}>
        {PAYMENT_TEMPLATE_ICON_OPTIONS.map(item => {
          const isSelected = item.icon === selectedIcon;
          return (
            <TouchableOpacity
              key={item.icon}
              onPress={() => onChange(item.icon)}
              style={styles.iconWrapper}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Icono ${item.label}`}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: isSelected ? activeColor : backgroundColor,
                    borderColor: isSelected ? activeColor : inactiveColor,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={isSelected ? iconSelectedColor : iconDefaultColor}
                />
              </View>
              <ThemedText style={styles.iconLabel} numberOfLines={1}>
                {item.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      <ThemedText style={styles.selectedLabel}>
        {selectedOption
          ? `Icono seleccionado: ${selectedOption.label}`
          : 'Elegí un icono para el acceso rápido'}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
    width: '30%',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
  },
  iconLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  selectedLabel: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default ShortcutIconSelector;
