import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import AddressLocationPicker from '@/components/AddressLocationPicker';
import { CompanyAddress } from '@/contexts/CompaniesContext';
import {
  buildCompanyAddressPayload,
  coordinateInputValue,
  createEmptyCompanyAddress,
  sanitizeCompanyAddressDrafts,
} from '@/utils/companyAddressForm';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { formatCompanyAddress } from '@/utils/address';

type CompanyAddressesModalProps = {
  visible: boolean;
  onClose: () => void;
  companyId: number;
  existingAddresses: CompanyAddress[];
  onAddressesCreated?: () => Promise<void> | void;
  canEdit: boolean;
};

const CompanyAddressesModal: React.FC<CompanyAddressesModalProps> = ({
  visible,
  onClose,
  companyId,
  existingAddresses,
  onAddressesCreated,
  canEdit,
}) => {
  const [drafts, setDrafts] = useState<CompanyAddress[]>([createEmptyCompanyAddress()]);
  const [saving, setSaving] = useState(false);
  const { token } = useContext(AuthContext);

  const backgroundColor = useThemeColor({ light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.65)' }, 'background');
  const cardColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const inputBackground = useThemeColor({ light: '#fafafa', dark: '#2c2c2e' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#aaa' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  useEffect(() => {
    if (!visible) {
      setDrafts([createEmptyCompanyAddress()]);
    }
  }, [visible]);

  const updateDraftField = useCallback((index: number, field: keyof CompanyAddress, value: string) => {
    setDrafts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const updateDraftCoordinates = useCallback((
    index: number,
    coordinate: { latitude: number; longitude: number } | null,
  ) => {
    setDrafts(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        latitude: coordinate ? coordinate.latitude.toString() : '',
        longitude: coordinate ? coordinate.longitude.toString() : '',
      };
      return next;
    });
  }, []);

  const addDraft = useCallback(() => {
    setDrafts(prev => [...prev, createEmptyCompanyAddress()]);
  }, []);

  const removeDraft = useCallback((index: number) => {
    setDrafts(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSaveDrafts = useCallback(async () => {
    if (!token) {
      Alert.alert('Sesión expirada', 'Iniciá sesión nuevamente para guardar direcciones.');
      return;
    }

    const sanitized = sanitizeCompanyAddressDrafts(drafts);
    if (!sanitized.length) {
      Alert.alert('Sin datos', 'Completá al menos una dirección antes de guardar.');
      return;
    }

    setSaving(true);

    try {
      for (const draft of sanitized) {
        const payload = buildCompanyAddressPayload(companyId, draft);
        if (!payload) {
          continue;
        }
        const response = await fetch(`${BASE_URL}/company-addresses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let details = '';
          try {
            details = await response.text();
          } catch {
            // ignore body parsing errors
          }
          throw new Error(details || 'No se pudo crear la dirección');
        }
      }

      Alert.alert('Direcciones guardadas', 'Las nuevas direcciones se agregaron a la empresa.');
      setDrafts([createEmptyCompanyAddress()]);
      if (onAddressesCreated) {
        await onAddressesCreated();
      }
    } catch (error) {
      console.error('Error creating company addresses:', error);
      Alert.alert('Error', 'No se pudieron guardar las direcciones. Intentá nuevamente.');
    } finally {
      setSaving(false);
    }
  }, [companyId, drafts, onAddressesCreated, token]);

  const existingList = useMemo(() => existingAddresses || [], [existingAddresses]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor }]}> 
        <View style={[styles.modalCard, { backgroundColor: cardColor, borderColor }]}> 
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Direcciones de la empresa</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={styles.sectionLabel}>Registradas actualmente</ThemedText>
            {existingList.length ? (
              existingList.map((address, index) => (
                <View key={`existing-${address.id ?? index}`} style={[styles.existingCard, { borderColor }]}> 
                  <ThemedText style={styles.existingTitle}>
                    {address.label?.trim() || `Dirección #${index + 1}`}
                  </ThemedText>
                  <ThemedText style={styles.existingDescription}>
                    {formatCompanyAddress(address) || 'Sin datos completos'}
                  </ThemedText>
                  {address.is_primary ? (
                    <ThemedText style={styles.existingBadge}>Principal</ThemedText>
                  ) : null}
                </View>
              ))
            ) : (
              <ThemedText style={styles.helperText}>Aún no se registraron direcciones.</ThemedText>
            )}

            {!canEdit ? (
              <ThemedText style={styles.helperText}>No tenés permiso para cargar nuevas direcciones.</ThemedText>
            ) : (
              <>
                <ThemedText style={[styles.sectionLabel, styles.formSection]}>Agregar nuevas direcciones</ThemedText>
                {drafts.map((draft, index) => (
                  <View key={`draft-${index}`} style={[styles.card, { borderColor }]}> 
                    <ThemedText style={styles.label}>Calle</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.street}
                      onChangeText={text => updateDraftField(index, 'street', text)}
                      placeholder="Calle"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Número</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.number ?? ''}
                      onChangeText={text => updateDraftField(index, 'number', text)}
                      placeholder="123"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Ciudad</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.city ?? ''}
                      onChangeText={text => updateDraftField(index, 'city', text)}
                      placeholder="Ciudad"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Provincia</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.state ?? ''}
                      onChangeText={text => updateDraftField(index, 'state', text)}
                      placeholder="Provincia"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>País</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.country ?? ''}
                      onChangeText={text => updateDraftField(index, 'country', text)}
                      placeholder="País"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Notas</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        styles.multiline,
                        { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                      ]}
                      value={draft.notes ?? ''}
                      onChangeText={text => updateDraftField(index, 'notes', text)}
                      placeholder="Referencias"
                      placeholderTextColor={placeholderColor}
                      multiline
                    />

                    <ThemedText style={styles.label}>Ubicación GPS</ThemedText>
                    <AddressLocationPicker
                      latitude={draft.latitude}
                      longitude={draft.longitude}
                      editable
                      onChange={coordinate => updateDraftCoordinates(index, coordinate)}
                    />

                    <View style={styles.coordinateRow}>
                      <View style={styles.coordinateInputContainer}>
                        <ThemedText style={styles.coordinateLabel}>Latitud</ThemedText>
                        <TextInput
                          style={[
                            styles.input,
                            styles.coordinateInput,
                            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                          ]}
                          value={coordinateInputValue(draft.latitude)}
                          onChangeText={text => updateDraftField(index, 'latitude', text)}
                          placeholder="-34.6037"
                          placeholderTextColor={placeholderColor}
                        />
                      </View>
                      <View style={[styles.coordinateInputContainer, styles.lastCoordinateInput]}>
                        <ThemedText style={styles.coordinateLabel}>Longitud</ThemedText>
                        <TextInput
                          style={[
                            styles.input,
                            styles.coordinateInput,
                            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                          ]}
                          value={coordinateInputValue(draft.longitude)}
                          onChangeText={text => updateDraftField(index, 'longitude', text)}
                          placeholder="-58.3816"
                          placeholderTextColor={placeholderColor}
                        />
                      </View>
                    </View>

                    {drafts.length > 1 ? (
                      <TouchableOpacity style={styles.removeButton} onPress={() => removeDraft(index)}>
                        <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                <TouchableOpacity style={[styles.addDraftButton, { borderColor }]} onPress={addDraft}>
                  <ThemedText style={styles.addDraftButtonText}>➕ Agregar otra dirección</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: buttonColor }]}
                  onPress={handleSaveDrafts}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={buttonTextColor} />
                  ) : (
                    <ThemedText style={[styles.saveButtonText, { color: buttonTextColor }]}>Guardar direcciones</ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  closeButtonText: {
    fontWeight: '500',
  },
  modalScroll: {
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formSection: {
    marginTop: 16,
  },
  existingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  existingTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  existingDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  existingBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  coordinateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  coordinateInputContainer: {
    flex: 1,
    marginRight: 8,
  },
  lastCoordinateInput: {
    marginRight: 0,
  },
  coordinateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  coordinateInput: {
    textAlign: 'center',
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  removeButtonText: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  addDraftButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addDraftButtonText: {
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: '600',
  },
});

export default CompanyAddressesModal;
