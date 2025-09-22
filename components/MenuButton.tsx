import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  AccessibilityState,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { IconName } from '@/constants/menuSections';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';

import { ThemedText } from './ThemedText';

export interface MenuButtonProps {
  title: string;
  icon: IconName;
  onPress: () => void;
  subtitle?: string;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityState?: AccessibilityState;
}

export const MenuButton: React.FC<MenuButtonProps> = ({
  title,
  icon,
  onPress,
  subtitle,
  showChevron = true,
  style,
  accessibilityState,
}) => {
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const cardBackgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#3d2f4d' }, 'background');
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: cardBackgroundColor,
          borderColor: tintColor,
          shadowColor: isLightMode ? '#00000020' : '#00000080',
        },
        !isLightMode && styles.darkModeShadow,
        style,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: tintColor }]}> 
        <Ionicons name={icon} size={28} color={iconForegroundColor} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
      </View>
      {showChevron ? <Ionicons name="chevron-forward" size={22} color={textColor} /> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  darkModeShadow: {
    shadowOpacity: 0.35,
    elevation: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
});

export default MenuButton;
