import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type RadioOption<T extends string> = {
  label: string;
  value: T;
};

type RadioGroupProps<T extends string> = {
  options: RadioOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function RadioGroup<T extends string>({
  options,
  value,
  onValueChange,
  disabled = false,
  style,
}: RadioGroupProps<T>) {
  const borderColor = useThemeColor({ light: '#d4d4d4', dark: '#4a4a4a' }, 'background');
  const selectedColor = useThemeColor({}, 'button');
  const backgroundColor = useThemeColor({ light: '#ffffff', dark: '#1f1f1f' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const disabledTextColor = useThemeColor({ light: '#9a9a9a', dark: '#7a7a7a' }, 'text');

  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              {
                borderColor: isSelected ? selectedColor : borderColor,
                backgroundColor: isSelected ? selectedColor : backgroundColor,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => {
              if (!disabled) {
                onValueChange(option.value);
              }
            }}
          >
            <ThemedText
              style={[
                styles.optionLabel,
                {
                  color: disabled
                    ? disabledTextColor
                    : isSelected
                      ? backgroundColor
                      : textColor,
                },
              ]}
            >
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    columnGap: 8,
    rowGap: 8,
    flexWrap: 'wrap',
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 999,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default RadioGroup;
