import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';

type ThemedTextInputProps = TextInputProps & {
  label?: string;
  helperText?: string | null;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export const ThemedTextInput: React.FC<ThemedTextInputProps> = ({
  label,
  helperText,
  error,
  containerStyle,
  style,
  ...props
}) => {
  const backgroundColor = useThemeColor({ light: '#ffffff', dark: '#2a2a2a' }, 'background');
  const borderColor = useThemeColor({ light: '#d9d9d9', dark: '#444444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#737373', dark: '#c7c7c7' }, 'text');
  const errorColor = '#d14343';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <ThemedText style={styles.label} accessibilityRole="text">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor,
            borderColor: error ? errorColor : borderColor,
            color: textColor,
          },
          style,
        ]}
        placeholderTextColor={placeholderColor}
        {...props}
      />
      {error ? <Text style={[styles.feedback, { color: errorColor }]}>{error}</Text> : null}
      {!error && helperText ? (
        <Text style={[styles.feedback, styles.helper]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  label: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  feedback: {
    marginTop: 6,
    fontSize: 13,
  },
  helper: {
    color: '#6b7280',
  },
});

export default ThemedTextInput;
