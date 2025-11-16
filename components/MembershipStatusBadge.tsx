import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MembershipLifecycleStatus,
  getMembershipStatusMetadata,
} from '@/constants/companyMemberships';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface MembershipStatusBadgeProps {
  normalizedStatus?: MembershipLifecycleStatus | null;
  fallbackLabel?: string | null;
  size?: 'sm' | 'md';
}

export const MembershipStatusBadge: React.FC<MembershipStatusBadgeProps> = ({
  normalizedStatus = null,
  fallbackLabel = 'Sin estado',
  size = 'md',
}) => {
  const meta = getMembershipStatusMetadata(normalizedStatus);

  const backgroundColor = useThemeColor(
    {
      light: meta?.colors.lightBackground ?? '#e0e0e0',
      dark: meta?.colors.darkBackground ?? '#3a3a3a',
    },
    'background'
  );

  const textColor = useThemeColor(
    {
      light: meta?.colors.lightText ?? '#111111',
      dark: meta?.colors.darkText ?? '#f5f5f5',
    },
    'text'
  );

  const label = meta?.label ?? fallbackLabel ?? 'Sin estado';

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSmall : styles.badgeMedium,
        { backgroundColor },
      ]}
    >
      <ThemedText style={[styles.badgeLabel, { color: textColor }]}>{label}</ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
