import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { InvoiceDetailView } from './InvoiceDetailView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const background = useThemeColor({}, 'background');

  const rawId = Array.isArray(id) ? id?.[0] : id;
  const invoiceId = rawId ? Number(rawId) : NaN;

  if (!rawId || Number.isNaN(invoiceId)) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText style={styles.message}>No se encontró la factura solicitada.</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: background }]}>
      <InvoiceDetailView invoiceId={invoiceId} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { textAlign: 'center' },
});
