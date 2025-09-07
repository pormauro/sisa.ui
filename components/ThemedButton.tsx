import React from 'react';
import { TouchableOpacity, Text, StyleSheet, type TouchableOpacityProps, StyleProp, TextStyle } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedButtonProps = TouchableOpacityProps & {
  title: string;
  lightColor?: string;
  darkColor?: string;
  lightTextColor?: string;
  darkTextColor?: string;
  textStyle?: StyleProp<TextStyle>;
};

export function ThemedButton({
  title,
  style,
  lightColor,
  darkColor,
  lightTextColor,
  darkTextColor,
  textStyle,
  ...otherProps
}: ThemedButtonProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'button');
  const color = useThemeColor({ light: lightTextColor, dark: darkTextColor }, 'buttonText');

  return (
    <TouchableOpacity style={[styles.button, { backgroundColor }, style]} {...otherProps}>
      <Text style={[styles.text, { color }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ThemedButton;

