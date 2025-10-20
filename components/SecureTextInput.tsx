import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';

type SecureTextInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label?: string;
  helperText?: string | null;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export const SecureTextInput: React.FC<SecureTextInputProps> = ({
  label,
  helperText,
  error,
  containerStyle,
  style,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const backgroundColor = useThemeColor({ light: '#ffffff', dark: '#2a2a2a' }, 'background');
  const borderColor = useThemeColor({ light: '#d9d9d9', dark: '#444444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#737373', dark: '#c7c7c7' }, 'text');
  const iconColor = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const errorColor = '#d14343';
  const shouldMask = !isVisible && !props.multiline;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor,
            borderColor: error ? errorColor : borderColor,
          },
        ]}
      >
        <TextInput
          style={[styles.input, props.multiline && styles.multilineInput, { color: textColor }, style]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={shouldMask}
          {...props}
        />
        <Pressable
          onPress={() => setIsVisible((prev) => !prev)}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.eyeButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Ocultar valor' : 'Mostrar valor'}
        >
          <Ionicons name={isVisible ? 'eye-off' : 'eye'} size={20} color={iconColor} />
        </Pressable>
      </View>
      {error ? <Text style={[styles.feedback, { color: errorColor }]}>{error}</Text> : null}
      {!error && helperText ? <Text style={[styles.feedback, styles.helper]}>{helperText}</Text> : null}
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
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    paddingVertical: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 16,
  },
  eyeButtonPressed: {
    opacity: 0.75,
  },
  feedback: {
    marginTop: 6,
    fontSize: 13,
  },
  helper: {
    color: '#6b7280',
  },
});

export default SecureTextInput;
