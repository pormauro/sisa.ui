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
  onLongPress?: () => void;
  subtitle?: string;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityState?: AccessibilityState;
  layout?: 'row' | 'grid';
}

export const MenuButton: React.FC<MenuButtonProps> = ({
  title,
  icon,
  onPress,
  onLongPress,
  subtitle,
  showChevron = true,
  style,
  accessibilityState,
  layout = 'row',
}) => {
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const cardBackgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#3d2f4d' }, 'background');
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const isGridLayout = layout === 'grid';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.container,
        isGridLayout ? styles.gridContainer : styles.rowContainer,
        {
          backgroundColor: cardBackgroundColor,
          borderColor: tintColor,
          shadowColor: isLightMode ? '#00000020' : '#00000080',
        },
        !isLightMode && styles.darkModeShadow,
        style,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          isGridLayout ? styles.iconContainerGrid : styles.iconContainerRow,
          { backgroundColor: tintColor },
        ]}
      >
        <Ionicons name={icon} size={isGridLayout ? 40 : 28} color={iconForegroundColor} />
      </View>
      <View style={[styles.textContainer, isGridLayout && styles.gridTextContainer]}>
        <ThemedText style={[styles.title, isGridLayout && styles.gridTitle]}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, isGridLayout && styles.gridSubtitle]}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {!isGridLayout && showChevron ? (
        <Ionicons name="chevron-forward" size={22} color={textColor} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
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
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridContainer: {
    flexBasis: '48%',
    alignItems: 'center',
  },
  darkModeShadow: {
    shadowOpacity: 0.35,
    elevation: 0,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerRow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  iconContainerGrid: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
  },
  gridTextContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  gridTitle: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  gridSubtitle: {
    textAlign: 'center',
  },
});

export default MenuButton;
