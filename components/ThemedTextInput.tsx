// /components/ThemedTextInput.tsx
import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextInputProps = TextInputProps;

export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  ({ style, multiline, ...rest }, ref) => {
    const backgroundColor = useThemeColor({ light: '#fff', dark: '#1e1e1e' }, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({ light: '#d0d0d0', dark: '#444' }, 'background');
    const placeholderColor = useThemeColor({ light: '#888', dark: '#aaa' }, 'text');

    return (
      <TextInput
        ref={ref}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { backgroundColor, color: textColor, borderColor },
          style,
        ]}
        placeholderTextColor={placeholderColor}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        {...rest}
      />
    );
  }
);

ThemedTextInput.displayName = 'ThemedTextInput';

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: {
    minHeight: 120,
    paddingTop: 12,
  },
});
