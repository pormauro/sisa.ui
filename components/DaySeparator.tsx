import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export const DaySeparator = ({ label }: { label: string }) => {
  const textColor = useThemeColor({ light: '#4B5563', dark: '#D1D5DB' }, 'text');
  const lineColor = useThemeColor({ light: '#E5E7EB', dark: '#374151' }, 'background');
  const labelBackground = useThemeColor({ light: '#F9FAFB', dark: '#111827' }, 'background');

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      <View style={[styles.labelContainer, { backgroundColor: labelBackground }]}>
        <ThemedText style={[styles.label, { color: textColor }]}>{label}</ThemedText>
      </View>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  labelContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
