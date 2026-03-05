// /app/clients/viewModal.tsx
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { AuthContext } from '@/contexts/AuthContext';
import { FileContext } from '@/contexts/FilesContext';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';
import { useClientInvoiceSummary } from '@/hooks/useClientInvoiceSummary';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { BASE_URL } from '@/config/Index';
import { openAttachment } from '@/utils/files/openAttachment';

const formatDateParam = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLabelDate = (date: Date): string =>
  date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export default function ViewClientModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { loadInvoices } = useContext(InvoicesContext);
  const { statuses } = useContext(StatusesContext);
  const { token } = useContext(AuthContext);
  const { getFile, getFileMetadata } = useContext(FileContext);
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const { getSummary: getInvoiceSummary } = useClientInvoiceSummary();
  const { permissions } = useContext(PermissionsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);
  const finalizedJobsTotal = getTotalForClient(client?.id);
  const canViewJobs = permissions.includes('listJobs');
  const canViewInvoices = permissions.includes('listInvoices');
  const canViewReceipts = permissions.includes('listReceipts');
  const canViewAccounting = canViewInvoices || canViewReceipts;
  const canViewClientCalendar = permissions.includes('listAppointments') || canViewJobs;
  const canExportClientJobsPdf = permissions.includes('exportClientJobsPdf');

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  const allStatusIds = useMemo(() => statuses.map(status => status.id), [statuses]);
  const areAllStatusesSelected =
    statuses.length > 0 && allStatusIds.every(statusId => selectedStatusIds.includes(statusId));

  useEffect(() => {
    const title = client?.business_name ?? 'Cliente';
    const options: Partial<NativeStackNavigationOptions> = { title };
    navigation.setOptions(options);
  }, [client?.business_name, navigation]);

  useEffect(() => {
    if (statuses.length === 0) {
      setSelectedStatusIds([]);
      return;
    }

    setSelectedStatusIds(prev => {
      if (prev.length === 0) {
        return statuses.map(status => status.id);
      }

      const validIds = prev.filter(selectedId => statuses.some(status => status.id === selectedId));
      return validIds;
    });
  }, [statuses]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewInvoices) {
        return;
      }
      void loadInvoices();
    }, [canViewInvoices, loadInvoices])
  );

  const background = useThemeColor({}, 'background');
  const linkColor = useThemeColor({}, 'tint');
  const actionBackground = useThemeColor({ light: '#EEF2FF', dark: '#1F2937' }, 'background');
  const actionText = useThemeColor({ light: '#1F2937', dark: '#F3F4F6' }, 'text');
  const actionBorder = useThemeColor({ light: '#CBD5F5', dark: '#374151' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Cliente no encontrado</ThemedText>
      </View>
    );
  }

  const invoiceSummary = canViewInvoices ? getInvoiceSummary(client.id) : undefined;
  const issuedInvoicesCount = invoiceSummary?.issuedCount ?? 0;
  const draftInvoicesCount = invoiceSummary?.draftCount ?? 0;
  const formattedIssuedInvoices = formatCurrency(invoiceSummary?.issuedTotal ?? 0);
  const formattedDraftInvoices = formatCurrency(invoiceSummary?.draftTotal ?? 0);
  const formattedUnpaidInvoicesTotal = formatCurrency(client.unpaid_invoices_total ?? 0);

  const handleOpenInvoices = () => {
    if (!canViewInvoices) {
      return;
    }
    router.push(`/clients/unpaidInvoices?id=${client.id}`);
  };

  const handleGenerateClientJobsReport = async (reportType: 'detailed-vertical' | 'summary-landscape') => {
    if (!canExportClientJobsPdf) {
      Alert.alert('Acceso denegado', 'No tienes permiso para generar este reporte.');
      return;
    }

    if (!token) {
      Alert.alert('Sesión inválida', 'Iniciá sesión nuevamente para generar el reporte.');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Rango inválido', 'La fecha de inicio no puede ser mayor que la de fin.');
      return;
    }

    const payload: {
      start_date: string;
      end_date: string;
      status_ids?: number[];
      display_options?: {
        show_start_time?: boolean;
        show_end_time?: boolean;
      };
    } = {
      start_date: formatDateParam(startDate),
      end_date: formatDateParam(endDate),
    };

    if (selectedStatusIds.length > 0) {
      payload.status_ids = selectedStatusIds;
    }

    if (reportType === 'detailed-vertical') {
      payload.display_options = {
        show_start_time: showStartTime,
        show_end_time: showEndTime,
      };
    }

    const endpoint =
      reportType === 'detailed-vertical'
        ? `${BASE_URL}/clients/${client.id}/jobs/report/pdf`
        : `${BASE_URL}/jobs/client/${client.id}/report/pdf/summary-landscape`;

    setIsGeneratingReport(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        let backendMessage = '';

        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          backendMessage =
            (typeof errorData?.message === 'string' && errorData.message) ||
            (typeof errorData?.error === 'string' && errorData.error) ||
            '';
        } else {
          backendMessage = (await response.text()).trim();
        }

        throw new Error(
          backendMessage
            ? `HTTP ${response.status}: ${backendMessage}`
            : `HTTP ${response.status}`
        );
      }

      const data = await response.json();
      const rawFileId = Number(data?.file_id ?? data?.id ?? data?.report_id ?? data?.pdf_file_id);
      const fileId = Number.isFinite(rawFileId) ? rawFileId : null;

      if (fileId === null) {
        Alert.alert('Respuesta incompleta', 'El backend no devolvió el ID del PDF generado.');
        return;
      }

      const [uri, meta] = await Promise.all([getFile(fileId), getFileMetadata(fileId)]);

      if (!uri) {
        Alert.alert('Archivo no disponible', 'No se pudo descargar el PDF generado.');
        return;
      }

      const opened = await openAttachment({
        uri,
        mimeType: meta?.mimeType || 'application/pdf',
        fileName: meta?.original_name || `reporte_cliente_${client.id}.pdf`,
      });

      if (!opened) {
        Alert.alert('Archivo descargado', 'El PDF se descargó, pero no se pudo abrir automáticamente.');
      } else {
        Alert.alert('Reporte generado', 'El PDF se generó, descargó y abrió correctamente.');
      }

      setReportModalVisible(false);
    } catch (error) {
      console.error('Error al generar reporte de trabajos del cliente:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo generar el reporte.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const toggleStatusFilter = (statusId: number) => {
    setSelectedStatusIds(prev =>
      prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]
    );
  };

  const actionButtons = [
    {
      key: 'edit',
      label: 'Editar',
      icon: 'create-outline' as const,
      visible: true,
      onPress: () => router.push(`/clients/${client.id}`),
    },
    {
      key: 'calendar',
      label: 'Calendario',
      icon: 'calendar-outline' as const,
      visible: canViewClientCalendar,
      onPress: () => router.push(`/clients/calendar?id=${client.id}`),
    },
    {
      key: 'jobs',
      label: 'Trabajos',
      icon: 'checkmark-done-outline' as const,
      visible: canViewJobs,
      onPress: () => router.push(`/clients/finalizedJobs?id=${client.id}`),
    },
    {
      key: 'accounting',
      label: 'Contabilidad',
      icon: 'file-tray-stacked-outline' as const,
      visible: canViewAccounting,
      onPress: () => router.push(`/clients/accounting?id=${client.id}`),
    },
    {
      key: 'jobs-report-pdf',
      label: 'PDF',
      icon: 'document-text-outline' as const,
      visible: canExportClientJobsPdf,
      onPress: () => setReportModalVisible(true),
    },
  ].filter(button => button.visible);

  return (
    <>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}> 
        <ThemedText style={styles.screenTitle} numberOfLines={2}>
          {client.business_name && client.business_name.trim().length > 0
            ? client.business_name
            : 'Cliente sin nombre'}
        </ThemedText>
        <CircleImagePicker fileId={client.profile_file_id} size={200} editable={false} />

        {client.tax_id ? (
          <>
            <ThemedText style={styles.label}>CUIT</ThemedText>
            <ThemedText style={styles.value}>{client.tax_id}</ThemedText>
          </>
        ) : null}

        {client.email ? (
          <>
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedText style={styles.value}>{client.email}</ThemedText>
          </>
        ) : null}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Montos pendientes</ThemedText>
          <TouchableOpacity
            style={[styles.sectionRow, !canViewJobs && styles.sectionRowDisabled]}
            onPress={() => router.push(`/clients/finalizedJobs?id=${client.id}`)}
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={!canViewJobs}
          >
            <ThemedText
              style={[
                styles.sectionLabel,
                canViewJobs ? { color: linkColor, textDecorationLine: 'underline' } : null,
              ]}
            >
              Total no facturado
            </ThemedText>
            <ThemedText style={styles.sectionValue}>
              {formatCurrency(finalizedJobsTotal)}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionRow, !canViewInvoices && styles.sectionRowDisabled]}
            onPress={handleOpenInvoices}
            activeOpacity={0.7}
            disabled={!canViewInvoices}
            accessibilityRole="button"
          >
            <ThemedText
              style={[
                styles.sectionLabel,
                canViewInvoices ? { color: linkColor, textDecorationLine: 'underline' } : null,
              ]}
            >
              Facturas impagas
            </ThemedText>
            <ThemedText style={styles.sectionValue}>{formattedUnpaidInvoicesTotal}</ThemedText>
          </TouchableOpacity>
        </View>

        {canViewInvoices ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Facturación</ThemedText>
            <View style={styles.invoiceSummaryRow}>
              <TouchableOpacity
                style={[styles.invoiceSummaryCard, { borderColor: actionBorder }]}
                activeOpacity={0.8}
                onPress={handleOpenInvoices}
              >
                <ThemedText style={styles.invoiceSummaryLabel}>Emitidas</ThemedText>
                <ThemedText style={styles.invoiceSummaryValue}>{formattedIssuedInvoices}</ThemedText>
                <ThemedText style={[styles.invoiceSummaryMeta, { color: linkColor }]}>
                  {issuedInvoicesCount} {issuedInvoicesCount === 1 ? 'comprobante' : 'comprobantes'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.invoiceSummaryCard, { borderColor: actionBorder }]}
                activeOpacity={0.8}
                onPress={handleOpenInvoices}
              >
                <ThemedText style={styles.invoiceSummaryLabel}>Borradores</ThemedText>
                <ThemedText style={styles.invoiceSummaryValue}>{formattedDraftInvoices}</ThemedText>
                <ThemedText style={[styles.invoiceSummaryMeta, { color: linkColor }]}>
                  {draftInvoicesCount} {draftInvoicesCount === 1 ? 'borrador' : 'borradores'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {tariff ? (
          <>
            <ThemedText style={styles.label}>Tarifa</ThemedText>
            <ThemedText style={styles.value}>{`${tariff.name} - ${tariff.amount}`}</ThemedText>
          </>
        ) : client.tariff_id ? (
          <>
            <ThemedText style={styles.label}>Tarifa</ThemedText>
            <ThemedText style={styles.value}>{client.tariff_id}</ThemedText>
          </>
        ) : null}

        {actionButtons.length ? (
          <View style={styles.actionsContainer}>
            {actionButtons.map(button => (
              <View style={styles.actionItem} key={button.key}>
                <TouchableOpacity
                  style={[styles.iconCircle, { backgroundColor: actionBackground, borderColor: actionBorder }]}
                  onPress={button.onPress}
                  activeOpacity={0.85}
                  disabled={button.key === 'jobs-report-pdf' && isGeneratingReport}
                >
                  {button.key === 'jobs-report-pdf' && isGeneratingReport ? (
                    <ActivityIndicator color={actionText} />
                  ) : (
                    <Ionicons name={button.icon} size={22} color={actionText} />
                  )}
                </TouchableOpacity>
                <ThemedText style={[styles.actionLabel, { color: actionText }]}>{button.label}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: inputBackground, borderColor: actionBorder }]}> 
            <ThemedText style={[styles.modalTitle, { color: inputTextColor }]}>Generar informe de trabajos</ThemedText>

            <ThemedText style={styles.modalLabel}>Rango de fechas</ThemedText>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: actionBorder }]}
                onPress={() => setShowStartPicker(true)}
              >
                <ThemedText style={{ color: inputTextColor }}>Desde: {formatLabelDate(startDate)}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: actionBorder }]}
                onPress={() => setShowEndPicker(true)}
              >
                <ThemedText style={{ color: inputTextColor }}>Hasta: {formatLabelDate(endDate)}</ThemedText>
              </TouchableOpacity>
            </View>

            {showStartPicker ? (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(_, selectedDate) => {
                  setShowStartPicker(false);
                  if (selectedDate) {
                    setStartDate(selectedDate);
                  }
                }}
              />
            ) : null}

            {showEndPicker ? (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(_, selectedDate) => {
                  setShowEndPicker(false);
                  if (selectedDate) {
                    setEndDate(selectedDate);
                  }
                }}
              />
            ) : null}

            <ThemedText style={styles.modalLabel}>Estados</ThemedText>
            <View style={styles.statusChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: buttonColor,
                    opacity: areAllStatusesSelected ? 1 : 0.3,
                  },
                ]}
                onPress={() => setSelectedStatusIds(allStatusIds)}
              >
                <ThemedText style={[styles.statusChipText, styles.statusChipTextDark]}>Todos</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: inputBackground,
                    borderWidth: 1,
                    borderColor: actionBorder,
                    opacity: selectedStatusIds.length === 0 ? 1 : 0.7,
                  },
                ]}
                onPress={() => setSelectedStatusIds([])}
              >
                <ThemedText style={[styles.statusChipText, { color: inputTextColor }]}>Ninguno</ThemedText>
              </TouchableOpacity>
              {statuses.map(status => {
                const isSelected = selectedStatusIds.includes(status.id);
                return (
                  <TouchableOpacity
                    key={`status-${status.id}`}
                    style={[
                      styles.statusChip,
                      { backgroundColor: status.background_color, opacity: isSelected ? 1 : 0.3 },
                    ]}
                    onPress={() => toggleStatusFilter(status.id)}
                  >
                    <ThemedText style={styles.statusChipText}>{status.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText style={styles.modalLabel}>Opciones reporte vertical detallado</ThemedText>
            <View style={styles.displayOptionsRow}>
              <TouchableOpacity
                style={[
                  styles.optionChip,
                  { backgroundColor: showStartTime ? buttonColor : inputBackground, borderColor: actionBorder },
                ]}
                onPress={() => setShowStartTime(prev => !prev)}
              >
                <ThemedText style={{ color: showStartTime ? buttonTextColor : inputTextColor }}>
                  Hora inicio
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionChip,
                  { backgroundColor: showEndTime ? buttonColor : inputBackground, borderColor: actionBorder },
                ]}
                onPress={() => setShowEndTime(prev => !prev)}
              >
                <ThemedText style={{ color: showEndTime ? buttonTextColor : inputTextColor }}>
                  Hora fin
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalActionButton, { backgroundColor: buttonColor }]}
              onPress={() => handleGenerateClientJobsReport('detailed-vertical')}
              disabled={isGeneratingReport}
            >
              {isGeneratingReport ? (
                <ActivityIndicator color={buttonTextColor} />
              ) : (
                <ThemedText style={[styles.modalActionButtonText, { color: buttonTextColor }]}>Generar vertical detallado</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionButton, { backgroundColor: buttonColor }]}
              onPress={() => handleGenerateClientJobsReport('summary-landscape')}
              disabled={isGeneratingReport}
            >
              <ThemedText style={[styles.modalActionButtonText, { color: buttonTextColor }]}>Generar horizontal resumido</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCloseSecondaryButton, { borderColor: actionBorder }]}
              onPress={() => setReportModalVisible(false)}
            >
              <ThemedText style={{ color: inputTextColor }}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  sectionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionRowDisabled: {
    opacity: 0.6,
  },
  sectionLabel: { fontSize: 15 },
  sectionValue: { fontSize: 15, fontWeight: '600' },
  invoiceSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  invoiceSummaryCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    margin: 4,
  },
  invoiceSummaryLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', opacity: 0.8 },
  invoiceSummaryValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  invoiceSummaryMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  actionsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 16,
    minWidth: 80,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { marginTop: 6, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipTextDark: {
    color: '#111827',
  },
  displayOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  optionChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalActionButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontWeight: '700',
  },
  modalCloseSecondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
});
