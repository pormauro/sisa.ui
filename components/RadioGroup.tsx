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
  const radioBackground = useThemeColor({ light: '#ffffff', dark: '#1f1f1f' }, 'background');
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
              { borderColor, opacity: disabled ? 0.6 : 1 },
            ]}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => {
              if (!disabled) {
                onValueChange(option.value);
              }
            }}
          >
            <View
              style={[
                styles.radio,
                {
                  borderColor: isSelected ? selectedColor : borderColor,
                  backgroundColor: radioBackground,
                },
              ]}
            >
              {isSelected && (
                <View
                  style={[
                    styles.radioInner,
                    {
                      backgroundColor: selectedColor,
                    },
                  ]}
                />
              )}
            </View>
            <ThemedText
              style={[
                styles.optionLabel,
                { color: disabled ? disabledTextColor : textColor },
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
    rowGap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    fontSize: 16,
  },
});

export default RadioGroup;
