// /app/clients/viewModal.tsx
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';
import { useClientInvoiceSummary } from '@/hooks/useClientInvoiceSummary';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { ensureAuthResponse } from '@/utils/auth/tokenGuard';
import { openAttachment } from '@/utils/files/openAttachment';
import { fileStorage } from '@/utils/files/storage';
import { Buffer } from 'buffer';

export default function ViewClientModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { loadInvoices } = useContext(InvoicesContext);
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const { getSummary: getInvoiceSummary } = useClientInvoiceSummary();
  const { permissions } = useContext(PermissionsContext);
  const { token } = useContext(AuthContext);
  const [isGeneratingClientReport, setIsGeneratingClientReport] = useState(false);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);
  const finalizedJobsTotal = getTotalForClient(client?.id);
  const canViewJobs = permissions.includes('listJobs');
  const canViewInvoices = permissions.includes('listInvoices');
  const canViewReceipts = permissions.includes('listReceipts');
  const canViewAccounting = canViewInvoices || canViewReceipts;
  const canViewClientCalendar = permissions.includes('listAppointments') || canViewJobs;
  const canExportClientJobsPdf = permissions.includes('exportClientJobsPdf');

  useEffect(() => {
    const title = client?.business_name ?? 'Cliente';
    const options: Partial<NativeStackNavigationOptions> = { title };
    navigation.setOptions(options);
  }, [client?.business_name, navigation]);

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


  const downloadReportFromUrl = async (downloadUrl: string) => {
      if (!token) {
        Alert.alert('Sesión inválida', 'Iniciá sesión nuevamente para descargar el reporte.');
        return;
      }

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      await ensureAuthResponse(response);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'No se pudo descargar el PDF generado.');
      }

      const contentType = response.headers.get('content-type') ?? 'application/pdf';
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('El PDF descargado está vacío.');
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const safeClientName = (client.business_name || `cliente_${client.id}`)
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
      const fileName = `trabajos_${safeClientName || `cliente_${client.id}`}_${Date.now()}.pdf`;
      const storagePath = `${fileStorage.documentDirectory ?? ''}${fileName}`;
      const { uri } = await fileStorage.write(storagePath, base64, 'application/pdf');

      await openAttachment({
        uri,
        fileName,
        mimeType: contentType.split(';')[0] || 'application/pdf',
        kind: 'pdf',
      });
    };

  const handleGenerateClientJobsPdf = async () => {
    if (!canExportClientJobsPdf) {
      Alert.alert('Permiso requerido', 'No tenés permiso para generar este reporte.');
      return;
    }

    if (!token) {
      Alert.alert('Sesión inválida', 'Iniciá sesión nuevamente para generar el reporte.');
      return;
    }

    setIsGeneratingClientReport(true);
    try {
      const response = await fetch(`${BASE_URL}/jobs/client/${client.id}/report/pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      await ensureAuthResponse(response);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'No se pudo generar el reporte de trabajos.');
      }

      const data = await response.json();
      const rawDownloadUrl = typeof data?.download_url === 'string' ? data.download_url : '';
      if (!rawDownloadUrl) {
        Alert.alert('Reporte generado', 'El backend no devolvió una URL de descarga.');
        return;
      }

      const resolvedDownloadUrl = /^https?:\/\//i.test(rawDownloadUrl)
        ? rawDownloadUrl
        : `${BASE_URL}${rawDownloadUrl.startsWith('/') ? '' : '/'}${rawDownloadUrl}`;

      await downloadReportFromUrl(resolvedDownloadUrl);
    } catch (error) {
      console.error('Error al generar/descargar reporte PDF del cliente:', error);
      Alert.alert('Error', 'No se pudo generar o descargar el reporte de trabajos.');
    } finally {
      setIsGeneratingClientReport(false);
    }
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
      key: 'client-jobs-pdf',
      label: 'Informe PDF',
      icon: 'download-outline' as const,
      visible: canExportClientJobsPdf,
      onPress: () => {
        void handleGenerateClientJobsPdf();
      },
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
  ].filter(button => button.visible);

  return (
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

      {isGeneratingClientReport ? (
        <View style={styles.loadingReportRow}>
          <ActivityIndicator size="small" />
          <ThemedText style={styles.loadingReportText}>Generando informe PDF...</ThemedText>
        </View>
      ) : null}

      {actionButtons.length ? (
        <View style={styles.actionsContainer}>
          {actionButtons.map(button => (
            <View style={styles.actionItem} key={button.key}>
              <TouchableOpacity
                style={[styles.iconCircle, { backgroundColor: actionBackground, borderColor: actionBorder }]}
                onPress={button.onPress}
                activeOpacity={0.85}
              >
                <Ionicons name={button.icon} size={22} color={actionText} />
              </TouchableOpacity>
              <ThemedText style={[styles.actionLabel, { color: actionText }]}>{button.label}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
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
  loadingReportRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  loadingReportText: {
    fontSize: 14,
  },
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
});
