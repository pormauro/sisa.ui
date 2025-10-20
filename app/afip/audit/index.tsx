import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { useAfipEvents } from '@/contexts/AfipEventsContext';
import { invoiceDetailStyles } from '@/app/invoices/InvoiceDetailView';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const useInvoiceLookup = () => {
  const { invoices } = useContext(InvoicesContext);
  return useMemo(() => {
    const map = new Map<number, string>();
    for (const invoice of invoices) {
      const id = Number(invoice.id);
      if (!Number.isFinite(id)) {
        continue;
      }
      const label =
        invoice.number ?? invoice.invoice_number ?? invoice.code ?? `#${invoice.id}`;
      map.set(id, label);
    }
    return map;
  }, [invoices]);
};

interface DateFilterProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ label, value, onChange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const themedBorder = useThemeColor({ light: '#d1d5db', dark: '#4b5563' }, 'background');
  const themedText = useThemeColor({}, 'text');
  const themedBackground = useThemeColor({ light: '#fff', dark: '#111827' }, 'background');

  return (
    <View style={styles.filterField}>
      <ThemedText style={styles.filterLabel}>{label}</ThemedText>
      <TouchableOpacity
        style={[styles.filterInput, { borderColor: themedBorder, backgroundColor: themedBackground }]}
        onPress={() => setIsVisible(true)}
      >
        <ThemedText style={{ color: themedText }}>
          {value ? formatDateTime(value) : 'Seleccionar fecha'}
        </ThemedText>
      </TouchableOpacity>
      {isVisible ? (
        <DateTimePicker
          mode="date"
          display="default"
          value={value ? new Date(value) : new Date()}
          onChange={(_event, date) => {
            setIsVisible(false);
            if (date) {
              onChange(date.toISOString());
            }
          }}
        />
      ) : null}
    </View>
  );
};

const normalizeInvoiceId = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return numeric;
};

const AfipAuditScreen: React.FC = () => {
  const router = useRouter();
  const invoiceLookup = useInvoiceLookup();
  const { filteredEvents, loadEvents, isLoading, setFilters, filters, lastUpdatedAt } =
    useAfipEvents();
  const [invoiceIdInput, setInvoiceIdInput] = useState(
    filters.invoiceId ? String(filters.invoiceId) : ''
  );
  const [pointOfSaleInput, setPointOfSaleInput] = useState(
    filters.pointOfSale ? String(filters.pointOfSale) : ''
  );
  const [fromDate, setFromDate] = useState<string | null>(filters.from ?? null);
  const [toDate, setToDate] = useState<string | null>(filters.to ?? null);

  const cardBackground = useThemeColor({ light: '#f9fafb', dark: 'rgba(255,255,255,0.05)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#4b5563' }, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const subtleText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  const handleApplyFilters = () => {
    const nextFilters = {
      invoiceId: normalizeInvoiceId(invoiceIdInput) ?? null,
      pointOfSale: pointOfSaleInput.trim() || null,
      from: fromDate,
      to: toDate,
    };
    setFilters(() => nextFilters);
    void loadEvents(nextFilters);
  };

  const handleResetFilters = () => {
    setInvoiceIdInput('');
    setPointOfSaleInput('');
    setFromDate(null);
    setToDate(null);
    const cleared = { invoiceId: null, pointOfSale: null, from: null, to: null };
    setFilters(() => cleared);
    void loadEvents(cleared);
  };

  const goBack = () => {
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={[styles.screen, { backgroundColor }]} style={{ backgroundColor }}>
      <View style={[styles.header, { marginBottom: 16 }]}>
        <TouchableOpacity onPress={goBack}>
          <ThemedText style={[styles.backLink, { color: tintColor }]}>Volver</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title}>Auditoría de solicitudes AFIP</ThemedText>
        <ThemedText style={[styles.subtitle, { color: subtleText }]}>
          Controla eventos, errores y CAE asociados a facturación electrónica.
        </ThemedText>
      </View>

      <View style={[invoiceDetailStyles.card, { backgroundColor: cardBackground, borderColor }]}
        accessibilityRole="form"
      >
        <ThemedText style={styles.sectionTitle}>Filtros</ThemedText>
        <View style={styles.filtersRow}>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Factura</ThemedText>
            <TextInput
              style={[styles.filterInput, { borderColor, color: subtleText }]}
              placeholder="ID de factura"
              placeholderTextColor={subtleText}
              keyboardType="numeric"
              value={invoiceIdInput}
              onChangeText={setInvoiceIdInput}
            />
          </View>
          <View style={styles.filterField}>
            <ThemedText style={styles.filterLabel}>Punto de venta</ThemedText>
            <TextInput
              style={[styles.filterInput, { borderColor, color: subtleText }]}
              placeholder="Ej: 0001"
              placeholderTextColor={subtleText}
              value={pointOfSaleInput}
              onChangeText={setPointOfSaleInput}
            />
          </View>
        </View>
        <View style={styles.filtersRow}>
          <DateFilter label="Desde" value={fromDate} onChange={setFromDate} />
          <DateFilter label="Hasta" value={toDate} onChange={setToDate} />
        </View>
        <View style={styles.filterActions}>
          <TouchableOpacity style={[styles.applyButton, { borderColor: tintColor }]}
            onPress={handleApplyFilters}
          >
            <ThemedText style={[styles.applyButtonText, { color: tintColor }]}>Aplicar filtros</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleResetFilters}>
            <ThemedText style={[styles.clearButtonText, { color: subtleText }]}>Limpiar</ThemedText>
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.lastUpdated, { color: subtleText }]}>
          Última actualización: {lastUpdatedAt ? formatDateTime(lastUpdatedAt.toISOString()) : '—'}
        </ThemedText>
      </View>

      <View style={styles.eventsHeader}>
        <ThemedText style={styles.sectionTitle}>Eventos</ThemedText>
        {isLoading ? <ActivityIndicator color={tintColor} /> : null}
      </View>

      {filteredEvents.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            No se encontraron eventos con los filtros seleccionados.
          </ThemedText>
        </View>
      ) : null}

      {filteredEvents.map(event => {
        const invoiceId =
          event.invoice_id ?? event.invoiceId ?? (event as any)['invoice'];
        const invoiceLabel = invoiceId ? invoiceLookup.get(Number(invoiceId)) : null;
        const status =
          event.status ?? event.level ?? (event as any)['severity'] ?? 'Evento';
        const message =
          event.message ?? event.detail ?? (event as any)['error_message'] ?? 'Sin descripción';
        const detail =
          (event as any)['error_detail'] ?? (event as any)['payload'] ?? null;

        return (
          <View
            key={event.id}
            style={[invoiceDetailStyles.card, styles.eventCard, { backgroundColor: cardBackground, borderColor }]}
          >
            <View style={styles.eventHeader}>
              <ThemedText style={styles.eventTitle}>
                {invoiceLabel ? `${invoiceLabel}` : `Factura ${invoiceId ?? '—'}`}
              </ThemedText>
              <View style={[styles.statusBadge]}>
                <ThemedText style={[styles.statusBadgeText, { color: tintColor }]}>
                  {status}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.eventTimestamp, { color: subtleText }]}>
              {formatDateTime(event.created_at ?? event.createdAt ?? null)}
            </ThemedText>
            <ThemedText style={styles.eventMessage}>{message}</ThemedText>
            {detail ? (
              <View style={[styles.eventDetailBox, { borderColor }]}
                accessible
                accessibilityLabel="Detalle del evento"
              >
                <ThemedText style={[styles.eventDetailText, { color: subtleText }]}>
                  {typeof detail === 'string'
                    ? detail
                    : JSON.stringify(detail, null, 2)}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.eventMetadata}>
              <ThemedText style={[styles.eventMetadataText, { color: subtleText }]}>
                Punto de venta: {event.point_of_sale ?? event.pointOfSale ?? '—'}
              </ThemedText>
              <ThemedText style={[styles.eventMetadataText, { color: subtleText }]}>
                ID evento: {event.id}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
  },
  header: {
    marginBottom: 12,
  },
  backLink: {
    fontSize: 14,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterField: {
    flex: 1,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lastUpdated: {
    marginTop: 8,
    fontSize: 13,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  eventCard: {
    marginBottom: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventTimestamp: {
    fontSize: 13,
    marginBottom: 6,
  },
  eventMessage: {
    fontSize: 15,
    marginBottom: 8,
  },
  eventDetailBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 13,
    lineHeight: 18,
  },
  eventMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventMetadataText: {
    fontSize: 13,
  },
});

export default AfipAuditScreen;
