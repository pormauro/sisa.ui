import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';

import { BASE_URL } from '@/config/Index';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FileContext } from '@/contexts/FilesContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import {
  ReportRecord,
  ReportsContext,
} from '@/contexts/ReportsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { openAttachment } from '@/utils/files/openAttachment';

const formatDateParam = (date: Date): string => date.toISOString().split('T')[0];

const formatLabelDate = (date: Date): string =>
  date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

const resolveDownloadUrl = (report: ReportRecord): string | null => {
  const rawUrl = report.download_url || (report.file_id ? `/files/${report.file_id}` : null);
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const normalized = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${BASE_URL}${normalized}`;
};

const extractRange = (metadata?: Record<string, unknown> | null): string | null => {
  if (!metadata) return null;
  const start = typeof metadata.start_date === 'string' ? metadata.start_date : null;
  const end = typeof metadata.end_date === 'string' ? metadata.end_date : null;
  if (start && end) return `${start} — ${end}`;
  return start ?? end;
};

const PaymentReportsScreen = () => {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { reports, loadReports, removeReport } = useContext(ReportsContext);
  const { getFile, getFileMetadata } = useContext(FileContext);

  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = permissions.includes('generatePaymentReport');
  const canListReports = permissions.includes('listReports');
  const canDeleteReports = permissions.includes('deleteReport');

  const themedBackground = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1f1f1f' }, 'background');
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: '#3a3a3a' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const destructiveColor = useThemeColor({ light: '#d32f2f', dark: '#ff6b6b' }, 'text');
  const secondaryText = useThemeColor({ light: '#555', dark: '#aaa' }, 'text');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const buttonColor = useThemeColor({}, 'button');

  useEffect(() => {
    if (!canGenerate && !canListReports) {
      Alert.alert(
        'Acceso denegado',
        'No tenés permisos para generar ni ver reportes de pagos.',
        [
          {
            text: 'Aceptar',
            onPress: () => router.back(),
          },
        ],
        { cancelable: false },
      );
    }
  }, [canGenerate, canListReports, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canListReports) return;
      void loadReports({ report_type: 'payments' });
    }, [canListReports, loadReports]),
  );

  const { refreshing, handleRefresh } = usePullToRefresh(
    () => loadReports({ report_type: 'payments' }),
    canListReports,
  );

  const paymentReports = useMemo(
    () =>
      reports.filter(report =>
        (report.report_type || '').toLowerCase().includes('payment'),
      ),
    [reports],
  );

  const handleGenerateReport = useCallback(async () => {
    if (!canGenerate) {
      Alert.alert('Permiso requerido', 'No podés generar reportes de pagos.');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('Rango inválido', 'La fecha de inicio no puede ser mayor que la de fin.');
      return;
    }

    setIsGenerating(true);
    const payload = {
      start_date: formatDateParam(startDate),
      end_date: formatDateParam(endDate),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`${BASE_URL}/payments/report/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      await ensureAuthResponse(response, { silent: false });

      if (response.status === 404) {
        const errorBody = await response.json().catch(() => ({}));
        const message =
          typeof errorBody?.message === 'string'
            ? errorBody.message
            : 'No se encontraron pagos con comprobantes en ese período.';
        Alert.alert('Sin resultados', message);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'No se pudo generar el reporte.');
      }

      const data = await response.json();
      const resolvedFileId = Number(data?.file_id ?? data?.id ?? data?.report_id);
      const fileId = Number.isFinite(resolvedFileId) ? resolvedFileId : null;

      if (fileId === null) {
        Alert.alert('Respuesta incompleta', 'El backend no devolvió el archivo generado.');
        return;
      }

      await getFile(fileId);

      Alert.alert('Reporte listo', 'El PDF se generó correctamente.');
      if (canListReports) {
        await loadReports({ report_type: 'payments' });
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        Alert.alert(
          'Tiempo de espera agotado',
          'No hubo respuesta del servidor al generar el PDF. Verificá tu conexión e intentá de nuevo.',
        );
        return;
      }
      if (isTokenExpiredError(error)) {
        return;
      }
      console.error('Error generating payment report:', error);
      Alert.alert('Error', 'No se pudo generar el reporte de pagos.');
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    canListReports,
    endDate,
    getFile,
    loadReports,
    startDate,
    token,
  ]);

  const handleDeleteReport = useCallback(
    (report: ReportRecord) => {
      if (!canDeleteReports) {
        Alert.alert('Permiso requerido', 'No podés eliminar reportes de pagos.');
        return;
      }

      Alert.alert(
        'Eliminar reporte',
        '¿Querés borrar este PDF y su registro? Esta acción no se puede deshacer.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              const fileId = Number(report.file_id);
              if (!Number.isFinite(fileId)) {
                Alert.alert('Operación no disponible', 'No se pudo identificar el archivo a eliminar.');
                return;
              }

              try {
                const response = await fetch(`${BASE_URL}/payments/report/${fileId}`, {
                  method: 'DELETE',
                  headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                });

                await ensureAuthResponse(response, { silent: false });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(errorText || 'No se pudo eliminar el reporte.');
                }

                removeReport(report.id);
                if (canListReports) {
                  await loadReports({ report_type: 'payments' });
                }
                Alert.alert('Reporte eliminado', 'Se borró el PDF y su registro asociado.');
              } catch (error) {
                if (isTokenExpiredError(error)) {
                  return;
                }
                console.error('Error deleting payment report:', error);
                Alert.alert('Error', 'No se pudo eliminar el reporte de pagos.');
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [canDeleteReports, canListReports, loadReports, removeReport, token],
  );

  const handleOpenReport = useCallback(
    async (report: ReportRecord) => {
      const fileId = Number(report.file_id);
      if (!Number.isFinite(fileId)) {
        Alert.alert('Descarga no disponible', 'No se pudo resolver el archivo del reporte.');
        return;
      }

      try {
        const [uri, meta] = await Promise.all([getFile(fileId), getFileMetadata(fileId)]);

        if (!uri) {
          throw new Error('No se pudo descargar el archivo del reporte.');
        }

        await openAttachment({
          uri,
          mimeType: meta?.file_type ?? 'application/pdf',
          fileName: meta?.original_name ?? `reporte_${fileId}.pdf`,
          kind: 'pdf',
          onInAppOpen: async () => {
            const fallbackUrl = resolveDownloadUrl(report);
            if (fallbackUrl) {
              await WebBrowser.openBrowserAsync(fallbackUrl);
            }
          },
        });
      } catch (error) {
        console.error('Error opening report file:', error);
        Alert.alert('Error', 'No se pudo abrir el PDF almacenado.');
      }
    },
    [getFile, getFileMetadata],
  );

  const renderReportItem = useCallback(
    ({ item }: { item: ReportRecord }) => {
      const range = extractRange(item.metadata);
      return (
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
            <ThemedText style={[styles.status, { color: secondaryText }]}>
              {item.status ?? 'generated'}
            </ThemedText>
          </View>
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>Archivo: #{item.file_id}</ThemedText>
          {range && (
            <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>
              Rango: {range}
            </ThemedText>
          )}
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={[styles.linkButton, { borderColor: accentColor }]}
              onPress={() => handleOpenReport(item)}
            >
              <ThemedText style={{ color: accentColor }}>Abrir PDF</ThemedText>
            </TouchableOpacity>
            {canDeleteReports && (
              <TouchableOpacity
                style={[styles.linkButton, styles.deleteButton, { borderColor: destructiveColor }]}
                onPress={() => handleDeleteReport(item)}
              >
                <ThemedText style={{ color: destructiveColor }}>Eliminar</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [
      accentColor,
      borderColor,
      canDeleteReports,
      cardBackground,
      destructiveColor,
      handleDeleteReport,
      handleOpenReport,
      secondaryText,
    ],
  );

  const listHeader = (
    <View style={styles.headerContainer}>
      <ThemedText style={styles.title}>Reportes de pagos</ThemedText>
      <ThemedText style={[styles.description, { color: secondaryText }]}>
        Generá un PDF con los comprobantes marcados como factura real dentro de un rango de fechas.
      </ThemedText>

      <View style={styles.dateRow}>
        <View style={styles.dateColumn}>
          <ThemedText style={styles.label}>Fecha de inicio</ThemedText>
          <TouchableOpacity
            style={[styles.dateInput, { backgroundColor: cardBackground, borderColor }]}
            onPress={() => setShowStartPicker(true)}
          >
            <ThemedText style={{ color: textColor }}>{formatLabelDate(startDate)}</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.dateColumn}>
          <ThemedText style={styles.label}>Fecha de fin</ThemedText>
          <TouchableOpacity
            style={[styles.dateInput, { backgroundColor: cardBackground, borderColor }]}
            onPress={() => setShowEndPicker(true)}
          >
            <ThemedText style={{ color: textColor }}>{formatLabelDate(endDate)}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {showStartPicker && (
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
      )}

      {showEndPicker && (
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
      )}

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: buttonColor }]}
        onPress={handleGenerateReport}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>
            Generar reporte
          </ThemedText>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={{ flex: 1, backgroundColor: themedBackground }}>
      <FlatList
        data={paymentReports}
        keyExtractor={item => `${item.report_type}-${item.id}`}
        renderItem={renderReportItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyState, { borderColor }]}>
            <ThemedText style={[styles.emptyText, { color: secondaryText }]}>
              Aún no generaste reportes de pagos. Completá el rango de fechas y tocá “Generar reporte”.
            </ThemedText>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[accentColor]} />
        }
      />
    </ThemedView>
  );
};

export default PaymentReportsScreen;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 10,
  },
  headerContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginBottom: 12,
  },
  dateColumn: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  status: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: 10,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteButton: {
    borderStyle: 'solid',
  },
  emptyState: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
});

