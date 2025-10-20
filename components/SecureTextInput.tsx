// /components/SecureTextInput.tsx
import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';

export interface SecureTextInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export const SecureTextInput = forwardRef<TextInput, SecureTextInputProps>(
  ({ style, containerStyle, multiline, ...rest }, ref) => {
    const [secure, setSecure] = useState(true);
    const backgroundColor = useThemeColor({ light: '#fff', dark: '#1e1e1e' }, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({ light: '#d0d0d0', dark: '#444' }, 'background');
    const placeholderColor = useThemeColor({ light: '#888', dark: '#aaa' }, 'text');
    const iconColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');

    const isSecureSupported = !multiline;

    return (
      <View style={[styles.container, { borderColor, backgroundColor }, containerStyle]}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            multiline ? styles.multiline : null,
            { color: textColor },
            style,
          ]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isSecureSupported ? secure : false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'auto'}
          {...rest}
        />
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setSecure(prev => !prev)}
          accessibilityRole="button"
          accessibilityLabel={secure ? 'Mostrar contenido' : 'Ocultar contenido'}
        >
          <Ionicons name={secure ? 'eye' : 'eye-off'} size={20} color={iconColor} />
        </TouchableOpacity>
      </View>
    );
  }
);

SecureTextInput.displayName = 'SecureTextInput';

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    paddingRight: 36,
  },
  multiline: {
    minHeight: 160,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  iconButton: {
    position: 'absolute',
    right: 8,
    padding: 8,
  },
});
