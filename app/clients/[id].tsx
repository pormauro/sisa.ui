// /app/clients/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';
import { ClientsContext } from '@/contexts/ClientsContext';
import type { ClientCompanySummary } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { StatusesContext } from '@/contexts/StatusesContext';

const createDefaultReportStartDate = (): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date;
};

const createDefaultReportEndDate = (): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
  return date;
};


export default function ClientDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEditClient = permissions.includes('updateClient');
  const canDeleteClient = permissions.includes('deleteClient');
  const canViewClientCalendar = permissions.includes('listAppointments') || permissions.includes('listJobs');
  const canExportClientJobsPdf = permissions.includes('exportClientJobsPdf');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); // Cambiado aquí
  const clientId = Number(id);
  const { clients, loadClients, updateClient, deleteClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { statuses, loadStatuses } = useContext(StatusesContext);
  const { token } = useContext(AuthContext);
  const {
    beginSelection,
    completeSelection,
    cancelSelection,
    consumeSelection,
    pendingSelections,
  } = usePendingSelection();

  const client = clients.find(c => c.id === clientId);

  const NEW_TARIFF_VALUE = 'new_tariff';

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#92272f' }, 'background');
  const deleteButtonTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [tariffId, setTariffId] = useState<string>('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date>(createDefaultReportStartDate);
  const [endDate, setEndDate] = useState<Date>(createDefaultReportEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

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

  const allStatusIds = useMemo(() => statuses.map(status => status.id), [statuses]);
  const areAllStatusesSelected =
    statuses.length > 0 && allStatusIds.every(statusId => selectedStatusIds.includes(statusId));

  const tariffItems = useMemo(
    () => [
      { label: 'Sin Tarifa', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...tariffs.map(t => ({ label: `${t.name} - ${t.amount}`, value: t.id.toString() })),
    ],
    [tariffs]
  );

  const companyItems = useMemo(() => {
    const formatter = (company: Company) => {
      const commercial = (company.name ?? '').trim();
      const legal = (company.legal_name ?? '').trim();
      return commercial || legal || `Empresa #${company.id}`;
    };
    return companies
      .map(company => ({ label: formatter(company), value: company.id.toString() }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [companies]);

  const selectedCompany = useMemo<Company | ClientCompanySummary | null>(() => {
    if (companyId) {
      const numeric = Number(companyId);
      if (Number.isFinite(numeric)) {
        const existing = companies.find(company => company.id === numeric);
        if (existing) {
          return existing;
        }
      }
    }
    return client?.company ?? null;
  }, [client?.company, companies, companyId]);

  useEffect(() => {
    if (!canEditClient && !canDeleteClient) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este cliente.');
      router.back();
    }
  }, [canDeleteClient, canEditClient, router]);

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    if (
      !Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.clients.tariff)
    ) {
      return;
    }
    const pendingTariffId = consumeSelection<string>(SELECTION_KEYS.clients.tariff);
    if (!pendingTariffId) {
      return;
    }
    const exists = tariffs.some(tariff => tariff.id.toString() === pendingTariffId);
    if (!exists) {
      return;
    }
    setTariffId(pendingTariffId);
  }, [pendingSelections, consumeSelection, tariffs]);

  useEffect(() => {
    if (client) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setCompanyId(client.company_id ? client.company_id.toString() : '');
      setTariffId(client.tariff_id ? client.tariff_id.toString() : '');
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadClients()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [client, hasAttemptedLoad, isFetchingItem, loadClients]);

  useEffect(() => {
    if (!canExportClientJobsPdf || statuses.length > 0) {
      return;
    }

    loadStatuses();
  }, [canExportClientJobsPdf, loadStatuses, statuses.length]);

  useEffect(() => {
    if (statuses.length === 0) {
      setSelectedStatusIds([]);
      return;
    }

    setSelectedStatusIds(prev => {
      if (prev.length === 0) {
        return statuses.map(status => status.id);
      }

      const validIds = prev.filter(id => statuses.some(status => status.id === id));
      return validIds;
    });
  }, [statuses]);

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Cliente no encontrado</ThemedText>
        )}
      </View>
    );
  }

  const handleUpdate = () => {
    /*if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, CUIT y Email');
      return;
    }*/
    Alert.alert(
      'Confirmar actualización',
      '¿Estás seguro de que deseas actualizar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            const success = await updateClient(clientId, {
              company_id: companyId ? parseInt(companyId, 10) : undefined,
              tariff_id: tariffId ? parseInt(tariffId, 10) : null,
            });
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente actualizado');
              completeSelection(clientId.toString());
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo actualizar el cliente');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  

  const handleDelete = async () => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => {
            setLoading(true);
            const success = await deleteClient(clientId);
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente eliminado');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo eliminar el cliente');
            }
          }
        },
      ]
    );
  };

  const handleGenerateClientJobsReport = async (reportType: 'detailed-vertical' | 'summary-landscape') => {
    if (!canExportClientJobsPdf) {
      Alert.alert('Acceso denegado', 'No tienes permiso para generar este reporte.');
      return;
    }

    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'No se pudo determinar el cliente para generar el reporte.');
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
        show_start_time: boolean;
        show_end_time: boolean;
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
        ? `${BASE_URL}/clients/${clientId}/jobs/report/pdf`
        : `${BASE_URL}/jobs/client/${clientId}/report/pdf/summary-landscape`;

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
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const downloadPath = typeof data?.download_url === 'string' ? data.download_url : '';
      const normalizedDownloadUrl = downloadPath
        ? /^https?:\/\//i.test(downloadPath)
          ? downloadPath
          : `${BASE_URL}${downloadPath.startsWith('/') ? '' : '/'}${downloadPath}`
        : '';

      Alert.alert(
        'Reporte generado',
        'El PDF fue generado correctamente.',
        [
          normalizedDownloadUrl
            ? {
                text: 'Descargar',
                onPress: () => {
                  void Linking.openURL(normalizedDownloadUrl);
                },
              }
            : { text: 'OK' },
          { text: 'Cerrar', style: 'cancel' },
        ]
      );
      setReportModalVisible(false);
    } catch (error) {
      console.error('Error al generar reporte de trabajos del cliente:', error);
      Alert.alert('Error', 'No se pudo generar el reporte.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const toggleStatusFilter = (statusId: number) => {
    setSelectedStatusIds(prev =>
      prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]
    );
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Empresa</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={[
          { label: '-- Selecciona una empresa --', value: '' },
          ...companyItems,
        ]}
        selectedValue={companyId}
        onValueChange={(value) => setCompanyId(value?.toString() ?? '')}
        placeholder="-- Selecciona una empresa --"
        disabled={!canEditClient}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value) return;
          router.push(`/companies/${value}`);
        }}
      />
      <View style={styles.companyActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor }]}
          onPress={() => router.push('/companies/create')}
        >
          <ThemedText style={{ color: inputTextColor }}>Crear empresa</ThemedText>
        </TouchableOpacity>
        {companyId ? (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor }]}
            onPress={() => router.push(`/companies/${companyId}`)}
          >
            <ThemedText style={{ color: inputTextColor }}>Ver empresa</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {selectedCompany ? (
        <View style={[styles.companySummary, { borderColor }]}> 
          <ThemedText style={[styles.summaryTitle, { color: inputTextColor }]}>Resumen</ThemedText>
          <ThemedText style={styles.summaryText}>
            {'name' in selectedCompany && selectedCompany.name
              ? selectedCompany.name
              : 'legal_name' in selectedCompany && selectedCompany.legal_name
              ? selectedCompany.legal_name
              : 'business_name' in selectedCompany && selectedCompany.business_name
              ? selectedCompany.business_name
              : 'Empresa seleccionada'}
          </ThemedText>
          {'tax_id' in selectedCompany && selectedCompany.tax_id ? (
            <ThemedText style={styles.summaryMeta}>CUIT: {selectedCompany.tax_id}</ThemedText>
          ) : null}
          {'email' in selectedCompany && selectedCompany.email ? (
            <ThemedText style={styles.summaryMeta}>{selectedCompany.email}</ThemedText>
          ) : null}
        </View>
      ) : null}

      <ThemedText style={styles.label}>Tarifa</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={tariffItems}
        selectedValue={tariffId}
        onValueChange={(itemValue) => {
          const value = itemValue?.toString() ?? '';
          if (value === NEW_TARIFF_VALUE) {
            setTariffId('');
            beginSelection(SELECTION_KEYS.clients.tariff);
            router.push('/tariffs/create');
            return;
          }
          setTariffId(value);
        }}
        placeholder="Sin Tarifa"
        disabled={!canEditClient}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.clients.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />
      {canViewClientCalendar && (
        <TouchableOpacity
          style={[styles.calendarButton, { backgroundColor: buttonColor }]}
          onPress={() => router.push({ pathname: '/clients/calendar', params: { id: client.id.toString() } })}
        >
          <ThemedText style={[styles.calendarButtonText, { color: buttonTextColor }]}>Abrir Calendario A</ThemedText>
        </TouchableOpacity>
      )}
      {canExportClientJobsPdf && (
        <TouchableOpacity
          style={[styles.calendarButton, { backgroundColor: buttonColor }]}
          onPress={() => setReportModalVisible(true)}
          disabled={isGeneratingReport}
        >
          {isGeneratingReport ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.calendarButtonText, { color: buttonTextColor }]}>Generar informes PDF</ThemedText>
          )}
        </TouchableOpacity>
      )}
      {canEditClient && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {canDeleteClient && (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
          onPress={handleDelete}
        >
          {loading ? (
            <ActivityIndicator color={deleteButtonTextColor} />
          ) : (
            <ThemedText style={[styles.deleteButtonText, { color: deleteButtonTextColor }]}>Eliminar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}
      <Modal
        animationType="slide"
        transparent
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: inputBackground, borderColor }]}> 
            <ThemedText style={[styles.modalTitle, { color: inputTextColor }]}>Generar informe de trabajos</ThemedText>

            <ThemedText style={styles.modalLabel}>Rango de fechas</ThemedText>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor }]}
                onPress={() => setShowStartPicker(true)}
              >
                <ThemedText style={{ color: inputTextColor }}>Desde: {formatLabelDate(startDate)}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor }]}
                onPress={() => setShowEndPicker(true)}
              >
                <ThemedText style={{ color: inputTextColor }}>Hasta: {formatLabelDate(endDate)}</ThemedText>
              </TouchableOpacity>
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
                    borderColor,
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
                  { backgroundColor: showStartTime ? buttonColor : inputBackground, borderColor },
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
                  { backgroundColor: showEndTime ? buttonColor : inputBackground, borderColor },
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
              style={[styles.modalCloseSecondaryButton, { borderColor }]}
              onPress={() => setReportModalVisible(false)}
            >
              <ThemedText style={{ color: inputTextColor }}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  select: {
    marginBottom: 8,
  },
  companySummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryMeta: {
    fontSize: 14,
  },
  companyActions: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    padding: 10,
  },
  calendarButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  calendarButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: 'bold' },
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
    columnGap: 8,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  statusChipTextDark: {
    color: '#fff',
  },
  displayOptionsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 4,
  },
  optionChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  modalActionButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontWeight: 'bold',
  },
  modalCloseSecondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    padding: 10,
  },
});
