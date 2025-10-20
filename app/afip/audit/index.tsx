import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { invoiceSharedStyles } from '@/components/invoices/InvoiceSharedStyles';
import { formatInvoiceDateTime, formatVoucherType } from '@/utils/invoiceFormatting';
import { useAfipEvents } from '@/contexts/AfipEventsContext';

const formatPayload = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : '—';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const AfipAuditScreen: React.FC = () => {
  const router = useRouter();
  const {
    events,
    filteredEvents,
    filters,
    setFilters,
    loadEvents,
    isLoading,
    lastSyncError,
    hydrated,
  } = useAfipEvents();

  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const errorBorder = useThemeColor({ light: '#fca5a5', dark: '#f87171' }, 'tint');
  const successBorder = useThemeColor({ light: '#bbf7d0', dark: '#4ade80' }, 'tint');

  const [invoiceFilter, setInvoiceFilter] = useState<string>('');
  const [posFilter, setPosFilter] = useState<string>('');
  const [fromFilter, setFromFilter] = useState<string>('');
  const [toFilter, setToFilter] = useState<string>('');

  useEffect(() => {
    setInvoiceFilter(filters.invoiceId ? String(filters.invoiceId) : '');
    setPosFilter(filters.pointOfSaleId ? String(filters.pointOfSaleId) : '');
    setFromFilter(filters.fromDate ?? '');
    setToFilter(filters.toDate ?? '');
  }, [filters.fromDate, filters.invoiceId, filters.pointOfSaleId, filters.toDate]);

  const handleApplyFilters = () => {
    setFilters(prev => ({
      ...prev,
      invoiceId: parseNumericInput(invoiceFilter),
      pointOfSaleId: parseNumericInput(posFilter),
      fromDate: fromFilter.trim() ? fromFilter.trim() : null,
      toDate: toFilter.trim() ? toFilter.trim() : null,
    }));
  };

  const handleClearFilters = () => {
    setInvoiceFilter('');
    setPosFilter('');
    setFromFilter('');
    setToFilter('');
    setFilters({});
  };

  const hasFilters = useMemo(
    () => Boolean(invoiceFilter || posFilter || fromFilter || toFilter),
    [fromFilter, invoiceFilter, posFilter, toFilter]
  );

  const eventsToRender = filteredEvents.length > 0 || hasFilters ? filteredEvents : events;

  const renderStatusLabel = (status?: string | null) => {
    if (!status) {
      return 'Sin estado';
    }
    const trimmed = status.toString().trim();
    return trimmed ? trimmed : 'Sin estado';
  };

  const getCardBorderColor = (event: typeof events[number]) => {
    const status = (event.status ?? event.level ?? '').toString().toLowerCase();
    if (status.includes('error') || status.includes('fail')) {
      return errorBorder;
    }
    if (status.includes('ok') || status.includes('aprob')) {
      return successBorder;
    }
    return borderColor;
  };

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.container}>
      <ThemedText style={[styles.title, { color: textColor }]}>Auditoría AFIP</ThemedText>

      <View style={[styles.filtersCard, { borderColor, backgroundColor: background }]}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Filtros</ThemedText>
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Factura</ThemedText>
            <TextInput
              value={invoiceFilter}
              onChangeText={setInvoiceFilter}
              placeholder="ID factura"
              placeholderTextColor={textColor + '66'}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </View>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Punto de venta</ThemedText>
            <TextInput
              value={posFilter}
              onChangeText={setPosFilter}
              placeholder="Nº"
              placeholderTextColor={textColor + '66'}
              keyboardType="numeric"
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Desde (YYYY-MM-DD)</ThemedText>
            <TextInput
              value={fromFilter}
              onChangeText={setFromFilter}
              placeholder="2024-01-01"
              placeholderTextColor={textColor + '66'}
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </View>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Hasta (YYYY-MM-DD)</ThemedText>
            <TextInput
              value={toFilter}
              onChangeText={setToFilter}
              placeholder="2024-12-31"
              placeholderTextColor={textColor + '66'}
              style={[styles.input, { borderColor, color: textColor }]}
            />
          </View>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: tintColor }]} onPress={handleApplyFilters}>
            <ThemedText style={styles.primaryButtonText}>Aplicar filtros</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: tintColor }]} onPress={handleClearFilters}>
            <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Limpiar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: tintColor }]}
            onPress={() => loadEvents()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={tintColor} />
            ) : (
              <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Refrescar</ThemedText>
            )}
          </TouchableOpacity>
        </View>
        {lastSyncError ? (
          <ThemedText style={[styles.errorText, { color: tintColor }]}>{lastSyncError}</ThemedText>
        ) : null}
      </View>

      {!hydrated && isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={tintColor} />
      ) : eventsToRender.length === 0 ? (
        <View style={[styles.emptyState, { borderColor }]}> 
          <ThemedText style={styles.emptyStateText}>
            No se registraron solicitudes AFIP con los filtros actuales.
          </ThemedText>
        </View>
      ) : (
        eventsToRender.map(event => {
          const timestamp = event.updated_at ?? event.created_at;
          const border = getCardBorderColor(event);
          return (
            <View
              key={event.id}
              style={[invoiceSharedStyles.card, styles.eventCard, { borderColor: border, backgroundColor: background }]}
            >
              <View style={styles.eventHeader}>
                <ThemedText style={styles.eventTitle}>{event.event_type ?? 'Evento AFIP'}</ThemedText>
                <ThemedText style={[styles.eventStatus, { color: border }]}>
                  {renderStatusLabel(event.status ?? event.level)}
                </ThemedText>
              </View>
              <View style={styles.eventMetaRow}>
                <ThemedText style={styles.eventMetaLabel}>Fecha</ThemedText>
                <ThemedText style={styles.eventMetaValue}>{formatInvoiceDateTime(timestamp)}</ThemedText>
              </View>
              {event.invoice_id ? (
                <View style={styles.eventMetaRow}>
                  <ThemedText style={styles.eventMetaLabel}>Factura</ThemedText>
                  <ThemedText style={styles.eventMetaValue}>#{event.invoice_id}</ThemedText>
                </View>
              ) : null}
              {event.afip_point_of_sale_id ? (
                <View style={styles.eventMetaRow}>
                  <ThemedText style={styles.eventMetaLabel}>Punto de venta</ThemedText>
                  <ThemedText style={styles.eventMetaValue}>{event.afip_point_of_sale_id}</ThemedText>
                </View>
              ) : null}
              {event.afip_voucher_type ? (
                <View style={styles.eventMetaRow}>
                  <ThemedText style={styles.eventMetaLabel}>Tipo de comprobante</ThemedText>
                  <ThemedText style={styles.eventMetaValue}>{formatVoucherType(event.afip_voucher_type)}</ThemedText>
                </View>
              ) : null}
              {event.message ? (
                <View style={styles.messageBlock}>
                  <ThemedText style={styles.messageLabel}>Mensaje</ThemedText>
                  <ThemedText style={styles.messageText}>{event.message}</ThemedText>
                </View>
              ) : null}
              {event.detail ? (
                <View style={styles.messageBlock}>
                  <ThemedText style={styles.messageLabel}>Detalle</ThemedText>
                  <ThemedText style={styles.messageText}>{event.detail}</ThemedText>
                </View>
              ) : null}
              {event.payload ? (
                <View style={styles.payloadBlock}>
                  <ThemedText style={styles.messageLabel}>Payload</ThemedText>
                  <View style={[styles.payloadContainer, { borderColor }]}> 
                    <ThemedText style={styles.payloadText}>{formatPayload(event.payload)}</ThemedText>
                  </View>
                </View>
              ) : null}
              {event.invoice_id ? (
                <TouchableOpacity
                  style={[styles.linkButton, { borderColor: tintColor }]}
                  onPress={() => router.push({ pathname: '/invoices/[id]', params: { id: String(event.invoice_id) } })}
                >
                  <ThemedText style={[styles.linkButtonText, { color: tintColor }]}>Ver factura</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

export default AfipAuditScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  filtersCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterField: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
  },
  eventCard: {
    marginBottom: 18,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  eventStatus: { fontSize: 13, fontWeight: '600' },
  eventMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  eventMetaLabel: { fontSize: 13, fontWeight: '600' },
  eventMetaValue: { fontSize: 13 },
  messageBlock: { marginTop: 12 },
  messageLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  messageText: { fontSize: 13, lineHeight: 18 },
  payloadBlock: { marginTop: 12 },
  payloadContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  payloadText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  linkButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
