import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import AddressLocationPicker from '@/components/AddressLocationPicker';
import { CompanyAddress } from '@/contexts/CompaniesContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  buildCompanyAddressPayload,
  coordinateInputValue,
  createEmptyCompanyAddress,
  sanitizeCompanyAddressDrafts,
} from '@/utils/companyAddressForm';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { formatCompanyAddress } from '@/utils/address';
import { toNumericCoordinate } from '@/utils/coordinates';

type CompanyAddressesModalProps = {
  visible: boolean;
  onClose: () => void;
  companyId: number;
  existingAddresses: CompanyAddress[];
  onAddressesUpdated?: () => Promise<void> | void;
  canEdit: boolean;
};

const normalizeExistingAddress = (address: CompanyAddress): CompanyAddress => ({
  ...createEmptyCompanyAddress(),
  ...address,
  street: address.street ?? '',
  number: address.number ?? '',
  floor: address.floor ?? '',
  apartment: address.apartment ?? '',
  city: address.city ?? '',
  state: address.state ?? '',
  country: address.country ?? '',
  postal_code: address.postal_code ?? '',
  notes: address.notes ?? '',
  latitude: coordinateInputValue(address.latitude),
  longitude: coordinateInputValue(address.longitude),
});

const CompanyAddressesModal: React.FC<CompanyAddressesModalProps> = ({
  visible,
  onClose,
  companyId,
  existingAddresses,
  onAddressesUpdated,
  canEdit,
}) => {
  const [drafts, setDrafts] = useState<CompanyAddress[]>([createEmptyCompanyAddress()]);
  const [existingDrafts, setExistingDrafts] = useState<CompanyAddress[]>([]);
  const [saving, setSaving] = useState(false);
  const [updatingAddressId, setUpdatingAddressId] = useState<number | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);
  const { token } = useContext(AuthContext);

  const backgroundColor = useThemeColor({ light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.65)' }, 'background');
  const cardColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const inputBackground = useThemeColor({ light: '#fafafa', dark: '#2c2c2e' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#aaa' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const switchThumbColor = useThemeColor({ light: '#fff', dark: '#f4f3f4' }, 'background');

  useEffect(() => {
    if (!visible) {
      setDrafts([createEmptyCompanyAddress()]);
    }
  }, [visible]);

  useEffect(() => {
    setExistingDrafts(existingAddresses.map(normalizeExistingAddress));
  }, [existingAddresses, visible]);

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

  const updateExistingDraftField = useCallback(
    (index: number, field: keyof CompanyAddress, value: string) => {
      setExistingDrafts(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const updateExistingDraftCoordinates = useCallback(
    (index: number, coordinate: { latitude: number; longitude: number } | null) => {
      setExistingDrafts(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          latitude: coordinate ? coordinate.latitude.toString() : '',
          longitude: coordinate ? coordinate.longitude.toString() : '',
        };
        return next;
      });
    },
    []
  );

  const addDraft = useCallback(() => {
    setDrafts(prev => [...prev, createEmptyCompanyAddress()]);
  }, []);

  const removeDraft = useCallback((index: number) => {
    setDrafts(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleTogglePrimary = useCallback((type: 'existing' | 'draft', index: number, value: boolean) => {
    if (type === 'existing') {
      setExistingDrafts(prev =>
        prev.map((draft, idx) => {
          if (idx === index) {
            return { ...draft, is_primary: value };
          }
          if (value) {
            return { ...draft, is_primary: false };
          }
          return draft;
        })
      );
      if (value) {
        setDrafts(prev => prev.map(draft => ({ ...draft, is_primary: false })));
      }
      return;
    }

    setDrafts(prev =>
      prev.map((draft, idx) => {
        if (idx === index) {
          return { ...draft, is_primary: value };
        }
        if (value) {
          return { ...draft, is_primary: false };
        }
        return draft;
      })
    );
    if (value) {
      setExistingDrafts(prev => prev.map(draft => ({ ...draft, is_primary: false })));
    }
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
      if (onAddressesUpdated) {
        await onAddressesUpdated();
      }
    } catch (error) {
      console.error('Error creating company addresses:', error);
      Alert.alert('Error', 'No se pudieron guardar las direcciones. Intentá nuevamente.');
    } finally {
      setSaving(false);
    }
  }, [companyId, drafts, onAddressesUpdated, token]);

  const handleSaveExisting = useCallback(
    async (index: number) => {
      if (!token) {
        Alert.alert('Sesión expirada', 'Iniciá sesión nuevamente para actualizar direcciones.');
        return;
      }

      const target = existingDrafts[index];
      if (!target?.id) {
        Alert.alert('Error', 'La dirección seleccionada no tiene un identificador válido.');
        return;
      }

      const [sanitized] = sanitizeCompanyAddressDrafts([target]);
      if (!sanitized) {
        Alert.alert('Sin datos', 'Completá al menos una parte de la dirección antes de guardar.');
        return;
      }

      const payload = buildCompanyAddressPayload(companyId, sanitized);
      if (!payload) {
        Alert.alert('Error', 'No se pudo preparar el contenido a enviar.');
        return;
      }

      setUpdatingAddressId(target.id);

      try {
        const response = await fetch(`${BASE_URL}/company-addresses/${target.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...payload,
            version: sanitized.version ?? target.version ?? 1,
          }),
        });

        if (!response.ok) {
          const errorMessage = await response.text();
          console.error('Error updating company address:', errorMessage);
          Alert.alert('Error', 'No se pudo actualizar la dirección seleccionada.');
          return;
        }

        setExistingDrafts(prev =>
          prev.map((draft, idx) => (idx === index ? normalizeExistingAddress({ ...draft, ...sanitized }) : draft))
        );
        await onAddressesUpdated?.();
      } catch (error) {
        console.error('Error updating company address:', error);
        Alert.alert('Error', 'Falló la actualización de la dirección. Intentá nuevamente.');
      } finally {
        setUpdatingAddressId(null);
      }
    },
    [companyId, existingDrafts, onAddressesUpdated, token]
  );

  const performDeleteExisting = useCallback(
    async (addressId: number) => {
      if (!token) {
        Alert.alert('Sesión expirada', 'Iniciá sesión nuevamente para eliminar direcciones.');
        return;
      }

      setDeletingAddressId(addressId);
      try {
        const response = await fetch(`${BASE_URL}/company-addresses/${addressId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorMessage = await response.text();
          console.error('Error deleting company address:', errorMessage);
          Alert.alert('Error', 'No se pudo eliminar la dirección seleccionada.');
          return;
        }

        setExistingDrafts(prev => prev.filter(address => address.id !== addressId));
        await onAddressesUpdated?.();
      } catch (error) {
        console.error('Error deleting company address:', error);
        Alert.alert('Error', 'Falló la eliminación. Intentá nuevamente.');
      } finally {
        setDeletingAddressId(null);
      }
    },
    [onAddressesUpdated, token]
  );

  const handleDeleteExisting = useCallback(
    (index: number) => {
      const target = existingDrafts[index];
      if (!target?.id) {
        Alert.alert('Error', 'La dirección seleccionada no tiene un identificador válido.');
        return;
      }

      Alert.alert('Eliminar dirección', 'Esta acción no se puede deshacer. ¿Deseás continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => performDeleteExisting(target.id!),
        },
      ]);
    },
    [existingDrafts, performDeleteExisting]
  );

  const existingList = useMemo(() => existingAddresses || [], [existingAddresses]);
  const hasExistingDrafts = existingDrafts.length > 0;

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
            {canEdit ? (
              hasExistingDrafts ? (
                existingDrafts.map((address, index) => (
                  <View key={`existing-${address.id ?? index}`} style={[styles.card, { borderColor }]}>
                    <ThemedText style={styles.cardTitle}>
                      {address.label?.trim() || `Dirección #${index + 1}`}
                    </ThemedText>

                    <ThemedText style={styles.label}>Etiqueta</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.label ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'label', text)}
                      placeholder="Casa central, Sucursal, etc."
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Calle</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.street}
                      onChangeText={text => updateExistingDraftField(index, 'street', text)}
                      placeholder="Calle"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Número</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.number ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'number', text)}
                      placeholder="123"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Piso</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.floor ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'floor', text)}
                      placeholder="Piso"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Departamento</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.apartment ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'apartment', text)}
                      placeholder="Departamento"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Ciudad</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.city ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'city', text)}
                      placeholder="Ciudad"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Provincia / Estado</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.state ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'state', text)}
                      placeholder="Provincia"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>País</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.country ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'country', text)}
                      placeholder="País"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Código Postal</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={address.postal_code ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'postal_code', text)}
                      placeholder="CP"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Notas</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        styles.multiline,
                        { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                      ]}
                      value={address.notes ?? ''}
                      onChangeText={text => updateExistingDraftField(index, 'notes', text)}
                      placeholder="Referencias"
                      placeholderTextColor={placeholderColor}
                      multiline
                    />

                    <View style={styles.primaryRow}>
                      <ThemedText style={styles.primaryLabel}>¿Es la dirección principal?</ThemedText>
                      <Switch
                        value={!!address.is_primary}
                        onValueChange={value => handleTogglePrimary('existing', index, value)}
                        trackColor={{ false: '#767577', true: buttonColor }}
                        thumbColor={switchThumbColor}
                      />
                    </View>

                    <ThemedText style={styles.label}>Ubicación GPS</ThemedText>
                    <AddressLocationPicker
                      latitude={address.latitude}
                      longitude={address.longitude}
                      editable
                      onChange={coordinate => updateExistingDraftCoordinates(index, coordinate)}
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
                          value={coordinateInputValue(address.latitude)}
                          onChangeText={text => updateExistingDraftField(index, 'latitude', text)}
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
                          value={coordinateInputValue(address.longitude)}
                          onChangeText={text => updateExistingDraftField(index, 'longitude', text)}
                          placeholder="-58.3816"
                          placeholderTextColor={placeholderColor}
                        />
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: buttonColor }]}
                        onPress={() => handleSaveExisting(index)}
                        disabled={updatingAddressId === address.id}
                      >
                        {updatingAddressId === address.id ? (
                          <ActivityIndicator color={buttonTextColor} />
                        ) : (
                          <ThemedText style={[styles.actionButtonText, { color: buttonTextColor }]}>Guardar cambios</ThemedText>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryActionButton}
                        onPress={() => handleDeleteExisting(index)}
                        disabled={deletingAddressId === address.id}
                      >
                        {deletingAddressId === address.id ? (
                          <ActivityIndicator color="#d32f2f" />
                        ) : (
                          <ThemedText style={styles.deleteButtonText}>Eliminar</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.helperText}>Aún no se registraron direcciones.</ThemedText>
              )
            ) : existingList.length ? (
              existingList.map((address, index) => (
                <View key={`existing-summary-${address.id ?? index}`} style={[styles.existingCard, { borderColor }]}>
                  <View style={styles.existingHeader}>
                    <ThemedText style={styles.existingTitle}>
                      {address.label?.trim() || `Dirección #${index + 1}`}
                    </ThemedText>
                    {toNumericCoordinate(address.latitude) !== null &&
                    toNumericCoordinate(address.longitude) !== null ? (
                      <View style={[styles.gpsIconBadge, { borderColor }]}>
                        <IconSymbol name="mappin.circle.fill" size={16} color={buttonColor} />
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={styles.existingDescription}>
                    {formatCompanyAddress(address) || 'Sin datos completos'}
                  </ThemedText>
                  {address.is_primary ? <ThemedText style={styles.existingBadge}>Principal</ThemedText> : null}
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
                    <ThemedText style={styles.label}>Etiqueta</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.label ?? ''}
                      onChangeText={text => updateDraftField(index, 'label', text)}
                      placeholder="Casa central, Sucursal, etc."
                      placeholderTextColor={placeholderColor}
                    />

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

                    <ThemedText style={styles.label}>Piso</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.floor ?? ''}
                      onChangeText={text => updateDraftField(index, 'floor', text)}
                      placeholder="Piso"
                      placeholderTextColor={placeholderColor}
                    />

                    <ThemedText style={styles.label}>Departamento</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.apartment ?? ''}
                      onChangeText={text => updateDraftField(index, 'apartment', text)}
                      placeholder="Departamento"
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

                    <ThemedText style={styles.label}>Provincia / Estado</ThemedText>
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

                    <ThemedText style={styles.label}>Código Postal</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
                      value={draft.postal_code ?? ''}
                      onChangeText={text => updateDraftField(index, 'postal_code', text)}
                      placeholder="CP"
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

                    <View style={styles.primaryRow}>
                      <ThemedText style={styles.primaryLabel}>¿Es la dirección principal?</ThemedText>
                      <Switch
                        value={!!draft.is_primary}
                        onValueChange={value => handleTogglePrimary('draft', index, value)}
                        trackColor={{ false: '#767577', true: buttonColor }}
                        thumbColor={switchThumbColor}
                      />
                    </View>

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
  existingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  existingTitle: {
    fontWeight: '600',
  },
  existingDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  existingBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  gpsIconBadge: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  primaryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontWeight: '600',
  },
  deleteButtonText: {
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
