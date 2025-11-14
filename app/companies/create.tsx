import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import CircleImagePicker from '@/components/CircleImagePicker';
import AddressLocationPicker from '@/components/AddressLocationPicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  CompaniesContext,
  CompanyAddress,
  CompanyContact,
  CompanyPayload,
  TaxIdentity,
} from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';
import { analyzeAdministratorIdsInput } from '@/utils/administratorIds';
import { toNumericCoordinate } from '@/utils/coordinates';

const IVA_OPTIONS = [
  { label: 'Responsable Inscripto', value: 'Responsable Inscripto' },
  { label: 'Responsable Monotributo', value: 'Responsable Monotributo' },
  { label: 'Exento', value: 'Exento' },
  { label: 'Consumidor Final', value: 'Consumidor Final' },
  { label: 'No Responsable', value: 'No Responsable' },
];

const createEmptyAddress = (): CompanyAddress => ({
  street: '',
  number: '',
  floor: '',
  apartment: '',
  city: '',
  state: '',
  country: '',
  postal_code: '',
  notes: '',
  latitude: null,
  longitude: null,
});

const createEmptyContact = (): CompanyContact => ({
  name: '',
  role: '',
  email: '',
  phone: '',
  mobile: '',
  notes: '',
});

const createEmptyIdentity = (): TaxIdentity => ({
  type: '',
  value: '',
  country: '',
  notes: '',
});

export default function CreateCompanyPage() {
  const router = useRouter();
  const { addCompany } = useContext(CompaniesContext);
  const { permissions } = useContext(PermissionsContext);
  const { normalizedUserId } = useSuperAdministrator();

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const sectionBackground = useThemeColor({ light: '#f8f8f8', dark: '#1a1a1a' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [profileFileId, setProfileFileId] = useState<string | null>(null);

  const [taxId, setTaxId] = useState('');
  const [ivaCondition, setIvaCondition] = useState('');
  const [startDate, setStartDate] = useState('');
  const [grossIncomeNumber, setGrossIncomeNumber] = useState('');
  const [fiscalNotes, setFiscalNotes] = useState('');
  const [additionalIdentities, setAdditionalIdentities] = useState<TaxIdentity[]>([]);

  const [addresses, setAddresses] = useState<CompanyAddress[]>([createEmptyAddress()]);
  const [contacts, setContacts] = useState<CompanyContact[]>([createEmptyContact()]);
  const [administratorIdsJson, setAdministratorIdsJson] = useState(() =>
    normalizedUserId ? JSON.stringify([normalizedUserId]) : '[]'
  );

  const administratorAnalysis = useMemo(
    () => analyzeAdministratorIdsInput(administratorIdsJson),
    [administratorIdsJson]
  );

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!permissions.includes('addCompany')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear empresas.');
      router.back();
    }
  }, [permissions, router]);

  useEffect(() => {
    if (!normalizedUserId) {
      return;
    }
    setAdministratorIdsJson(current => {
      if (current.trim().length) {
        return current;
      }
      return JSON.stringify([normalizedUserId]);
    });
  }, [normalizedUserId]);

  const ivaItems = useMemo(
    () => [{ label: 'Seleccionar condición IVA', value: '' }, ...IVA_OPTIONS],
    []
  );

  const coordinateInputValue = (value: string | number | null | undefined) => {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return '';
  };

  const updateAddressField = (index: number, field: keyof CompanyAddress, value: string) => {
    setAddresses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateAddressCoordinates = (
    index: number,
    coordinate: { latitude: number; longitude: number } | null,
  ) => {
    setAddresses(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        latitude: coordinate ? coordinate.latitude.toString() : '',
        longitude: coordinate ? coordinate.longitude.toString() : '',
      };
      return updated;
    });
  };

  const addAddress = () => {
    setAddresses(prev => [...prev, createEmptyAddress()]);
  };

  const removeAddress = (index: number) => {
    setAddresses(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateContactField = (index: number, field: keyof CompanyContact, value: string) => {
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addContact = () => {
    setContacts(prev => [...prev, createEmptyContact()]);
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateIdentityField = (index: number, field: keyof TaxIdentity, value: string) => {
    setAdditionalIdentities(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addIdentity = () => {
    setAdditionalIdentities(prev => [...prev, createEmptyIdentity()]);
  };

  const removeIdentity = (index: number) => {
    setAdditionalIdentities(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAppendCurrentUser = () => {
    if (!normalizedUserId) {
      Alert.alert('Usuario no disponible', 'No se pudo identificar tu usuario para agregarlo.');
      return;
    }
    setAdministratorIdsJson(current => {
      const analysis = analyzeAdministratorIdsInput(current);
      const next = new Set(analysis.ids);
      next.add(normalizedUserId);
      return JSON.stringify(Array.from(next));
    });
  };

  const sanitizeAddresses = (items: CompanyAddress[]) =>
    items
      .map(address => {
        const latitude = toNumericCoordinate(address.latitude);
        const longitude = toNumericCoordinate(address.longitude);

        return {
          street: address.street.trim(),
          number: address.number?.toString().trim() || null,
          floor: address.floor?.toString().trim() || null,
          apartment: address.apartment?.toString().trim() || null,
          city: address.city?.toString().trim() || null,
          state: address.state?.toString().trim() || null,
          country: address.country?.toString().trim() || null,
          postal_code: address.postal_code?.toString().trim() || null,
          notes: address.notes?.toString().trim() || null,
          latitude,
          longitude,
        };
      })
      .filter(address => {
        const hasText = address.street || address.city || address.country;
        const hasCoordinates = typeof address.latitude === 'number' && typeof address.longitude === 'number';
        return hasText || hasCoordinates;
      });

  const sanitizeContacts = (items: CompanyContact[]) =>
    items
      .map(contact => ({
        name: contact.name.trim(),
        role: contact.role?.trim() || null,
        email: contact.email?.trim() || null,
        phone: contact.phone?.trim() || null,
        mobile: contact.mobile?.trim() || null,
        notes: contact.notes?.trim() || null,
      }))
      .filter(contact => contact.name || contact.email || contact.phone || contact.mobile);

  const sanitizeIdentities = () => {
    const baseIdentities: TaxIdentity[] = [];
    if (taxId.trim()) {
      baseIdentities.push({ type: 'CUIT', value: taxId.trim() });
    }
    if (ivaCondition) {
      baseIdentities.push({ type: 'IVA_CONDITION', value: ivaCondition });
    }
    if (startDate.trim()) {
      baseIdentities.push({ type: 'START_DATE', value: startDate.trim() });
    }
    if (grossIncomeNumber.trim()) {
      baseIdentities.push({ type: 'GROSS_INCOME', value: grossIncomeNumber.trim() });
    }
    if (fiscalNotes.trim()) {
      baseIdentities.push({ type: 'FISCAL_NOTES', value: fiscalNotes.trim() });
    }

    const dynamicIdentities = additionalIdentities
      .map(identity => ({
        type: identity.type.trim(),
        value: identity.value.trim(),
        country: identity.country?.trim() || null,
        notes: identity.notes?.trim() || null,
      }))
      .filter(identity => identity.type && identity.value);

    return [...baseIdentities, ...dynamicIdentities];
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;

    if (!name.trim()) {
      Alert.alert('Datos incompletos', 'El nombre comercial es obligatorio.');
      submittingRef.current = false;
      return;
    }

    if (!administratorAnalysis.isValid) {
      Alert.alert('Administradores inválidos', administratorAnalysis.error ?? 'Revisá el formato JSON.');
      submittingRef.current = false;
      return;
    }

    setLoading(true);
    try {
      const sanitizedIdentities = sanitizeIdentities();
      const sanitizedAddresses = sanitizeAddresses(addresses);
      const sanitizedContacts = sanitizeContacts(contacts);

      const payload: CompanyPayload = {
        name: name.trim(),
        administrator_ids: administratorAnalysis.ids,
      };

      const trimmedLegalName = legalName.trim();
      if (trimmedLegalName) {
        payload.legal_name = trimmedLegalName;
      }

      const trimmedTaxId = taxId.trim();
      if (trimmedTaxId) {
        payload.tax_id = trimmedTaxId;
      }

      const trimmedWebsite = website.trim();
      if (trimmedWebsite) {
        payload.website = trimmedWebsite;
      }

      const trimmedPhone = phone.trim();
      if (trimmedPhone) {
        payload.phone = trimmedPhone;
      }

      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }

      const trimmedStatus = status.trim();
      if (trimmedStatus) {
        payload.status = trimmedStatus;
      }

      const trimmedNotes = notes.trim();
      if (trimmedNotes) {
        payload.notes = trimmedNotes;
      }

      if (profileFileId) {
        payload.profile_file_id = profileFileId;
      }

      if (sanitizedIdentities.length > 0) {
        payload.tax_identities = sanitizedIdentities;
      }

      if (sanitizedAddresses.length > 0) {
        payload.addresses = sanitizedAddresses;
      }

      if (sanitizedContacts.length > 0) {
        payload.contacts = sanitizedContacts;
      }

      const created = await addCompany(payload);
      if (created) {
        Alert.alert('Éxito', 'Empresa creada correctamente.');
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo crear la empresa.');
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un problema al crear la empresa.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const CollapsibleSection: React.FC<{
    title: string;
    children: React.ReactNode;
    initiallyOpen?: boolean;
    description?: string;
  }> = ({ title, children, initiallyOpen = false, description }) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);

    return (
      <View style={[styles.sectionContainer, { borderColor, backgroundColor: sectionBackground }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setIsOpen(prev => !prev)}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: isOpen }}
        >
          <View style={styles.sectionHeaderTextContainer}>
            <ThemedText style={styles.sectionHeaderTitle}>{title}</ThemedText>
            {description ? (
              <ThemedText style={styles.sectionHeaderDescription}>{description}</ThemedText>
            ) : null}
          </View>
          <ThemedText style={styles.sectionHeaderIndicator}>{isOpen ? '▾' : '▸'}</ThemedText>
        </TouchableOpacity>
        {isOpen ? <View style={styles.sectionContent}>{children}</View> : null}
      </View>
    );
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <ThemedText style={styles.sectionTitle}>Datos básicos</ThemedText>
      <ThemedText style={styles.helperText}>
        Solo el nombre comercial es obligatorio para crear una empresa.
      </ThemedText>
      <ThemedText style={styles.label}>Logo</ThemedText>
      <CircleImagePicker
        fileId={profileFileId}
        editable
        size={180}
        onImageChange={setProfileFileId}
      />

      <ThemedText style={styles.label}>Nombre Comercial *</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={setName}
        placeholder="Nombre comercial"
        placeholderTextColor={placeholderColor}
      />

      <CollapsibleSection
        title="Información comercial adicional"
        description="Razón social y datos de contacto"
      >
        <ThemedText style={styles.label}>Razón Social</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={legalName}
          onChangeText={setLegalName}
          placeholder="Razón social"
          placeholderTextColor={placeholderColor}
        />

        <ThemedText style={styles.label}>Sitio Web</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={website}
          onChangeText={setWebsite}
          placeholder="https://empresa.com"
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
        />

        <ThemedText style={styles.label}>Teléfono</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="Teléfono principal"
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
        />

        <ThemedText style={styles.label}>Email</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={email}
          onChangeText={setEmail}
          placeholder="contacto@empresa.com"
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <ThemedText style={styles.label}>Estado</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={status}
          onChangeText={setStatus}
          placeholder="Activo, Inactivo, etc."
          placeholderTextColor={placeholderColor}
        />

        <ThemedText style={styles.label}>Notas</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Observaciones generales"
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={4}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Datos fiscales"
        description="CUIT, condición IVA e identificaciones extra"
      >
        <ThemedText style={styles.label}>CUIT</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={taxId}
          onChangeText={setTaxId}
          placeholder="00-00000000-0"
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
        />

        <ThemedText style={styles.label}>Condición IVA</ThemedText>
        <SearchableSelect
          style={styles.select}
          items={ivaItems}
          selectedValue={ivaCondition}
          onValueChange={(value) => setIvaCondition(String(value ?? ''))}
          placeholder="Seleccionar"
        />

        <ThemedText style={styles.label}>Inicio de Actividades</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={placeholderColor}
        />

        <ThemedText style={styles.label}>Número de Ingresos Brutos</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={grossIncomeNumber}
          onChangeText={setGrossIncomeNumber}
          placeholder="Número IIBB"
          placeholderTextColor={placeholderColor}
        />

        <ThemedText style={styles.label}>Notas fiscales</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={fiscalNotes}
          onChangeText={setFiscalNotes}
          placeholder="Información adicional"
          placeholderTextColor={placeholderColor}
          multiline
        />

        <ThemedText style={styles.subSectionTitle}>Otras identificaciones</ThemedText>
        {additionalIdentities.map((identity, index) => (
          <View key={`identity-${index}`} style={[styles.card, { borderColor }]}
          >
            <ThemedText style={styles.label}>Tipo</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={identity.type}
              onChangeText={(text) => updateIdentityField(index, 'type', text)}
              placeholder="Tipo de identificación"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Valor</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={identity.value}
              onChangeText={(text) => updateIdentityField(index, 'value', text)}
              placeholder="Valor"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>País</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={identity.country ?? ''}
              onChangeText={(text) => updateIdentityField(index, 'country', text)}
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
              value={identity.notes ?? ''}
              onChangeText={(text) => updateIdentityField(index, 'notes', text)}
              placeholder="Notas"
              placeholderTextColor={placeholderColor}
              multiline
            />

            <TouchableOpacity style={styles.removeButton} onPress={() => removeIdentity(index)}>
              <ThemedText style={styles.removeButtonText}>Eliminar identificación</ThemedText>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addIdentity}>
          <ThemedText style={styles.addItemButtonText}>➕ Agregar identificación</ThemedText>
        </TouchableOpacity>
      </CollapsibleSection>

      <CollapsibleSection
        title="Administradores"
        description="IDs de usuarios autorizados a editar"
      >
        <ThemedText style={styles.helperText}>
          Ingresá un array JSON con los IDs de usuario que pueden editar esta empresa (ejemplo:
          [&quot;12&quot;, &quot;98&quot;]).
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            styles.jsonInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={administratorIdsJson}
          onChangeText={setAdministratorIdsJson}
          placeholder='["12","98"]'
          placeholderTextColor={placeholderColor}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!administratorAnalysis.isValid && administratorAnalysis.error ? (
          <ThemedText style={styles.errorText}>{administratorAnalysis.error}</ThemedText>
        ) : null}
        {administratorAnalysis.ids.length ? (
          <View style={styles.chipContainer}>
            {administratorAnalysis.ids.map(id => (
              <View key={id} style={styles.chip}>
                <ThemedText style={styles.chipText}>{id}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.helperText}>No hay administradores cargados.</ThemedText>
        )}
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor }]}
          onPress={handleAppendCurrentUser}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.secondaryButtonText}>
            Agregar mi usuario{normalizedUserId ? ` (${normalizedUserId})` : ''}
          </ThemedText>
        </TouchableOpacity>
      </CollapsibleSection>

      <CollapsibleSection title="Direcciones" description="Puntos físicos de contacto">
        {addresses.map((address, index) => (
          <View key={`address-${index}`} style={[styles.card, { borderColor }]}
          >
            <ThemedText style={styles.label}>Calle</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.street}
              onChangeText={(text) => updateAddressField(index, 'street', text)}
              placeholder="Calle"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Número</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.number ?? ''}
              onChangeText={(text) => updateAddressField(index, 'number', text)}
              placeholder="Número"
              placeholderTextColor={placeholderColor}
              keyboardType="numbers-and-punctuation"
            />

            <ThemedText style={styles.label}>Piso</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.floor ?? ''}
              onChangeText={(text) => updateAddressField(index, 'floor', text)}
              placeholder="Piso"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Departamento</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.apartment ?? ''}
              onChangeText={(text) => updateAddressField(index, 'apartment', text)}
              placeholder="Departamento"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Ciudad</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.city ?? ''}
              onChangeText={(text) => updateAddressField(index, 'city', text)}
              placeholder="Ciudad"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Provincia / Estado</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.state ?? ''}
              onChangeText={(text) => updateAddressField(index, 'state', text)}
              placeholder="Provincia"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>País</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.country ?? ''}
              onChangeText={(text) => updateAddressField(index, 'country', text)}
              placeholder="País"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Código Postal</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.postal_code ?? ''}
              onChangeText={(text) => updateAddressField(index, 'postal_code', text)}
              placeholder="CP"
              placeholderTextColor={placeholderColor}
              keyboardType="numbers-and-punctuation"
            />

            <ThemedText style={styles.label}>Notas</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: inputBackground, color: inputTextColor, borderColor },
              ]}
              value={address.notes ?? ''}
              onChangeText={(text) => updateAddressField(index, 'notes', text)}
              placeholder="Referencias adicionales"
              placeholderTextColor={placeholderColor}
              multiline
            />

            <ThemedText style={styles.label}>Ubicación GPS</ThemedText>
            <AddressLocationPicker
              latitude={address.latitude}
              longitude={address.longitude}
              onChange={(coordinate) => updateAddressCoordinates(index, coordinate)}
              editable
            />

            <View style={styles.coordinateInputsRow}>
              <View style={styles.coordinateInputContainer}>
                <ThemedText style={styles.coordinateLabel}>Latitud</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    styles.coordinateInput,
                    { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                  ]}
                  value={coordinateInputValue(address.latitude)}
                  onChangeText={(text) => updateAddressField(index, 'latitude', text)}
                  placeholder="-34.6037"
                  placeholderTextColor={placeholderColor}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.coordinateInputContainer}>
                <ThemedText style={styles.coordinateLabel}>Longitud</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    styles.coordinateInput,
                    { backgroundColor: inputBackground, color: inputTextColor, borderColor },
                  ]}
                  value={coordinateInputValue(address.longitude)}
                  onChangeText={(text) => updateAddressField(index, 'longitude', text)}
                  placeholder="-58.3816"
                  placeholderTextColor={placeholderColor}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {addresses.length > 1 ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeAddress(index)}>
                <ThemedText style={styles.removeButtonText}>Eliminar dirección</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addAddress}>
          <ThemedText style={styles.addItemButtonText}>➕ Agregar dirección</ThemedText>
        </TouchableOpacity>
      </CollapsibleSection>

      <CollapsibleSection title="Contactos" description="Personas de referencia y comunicación">
        {contacts.map((contact, index) => (
          <View key={`contact-${index}`} style={[styles.card, { borderColor }]}
          >
            <ThemedText style={styles.label}>Nombre</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.name}
              onChangeText={(text) => updateContactField(index, 'name', text)}
              placeholder="Nombre y apellido"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Cargo / Rol</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.role ?? ''}
              onChangeText={(text) => updateContactField(index, 'role', text)}
              placeholder="Cargo"
              placeholderTextColor={placeholderColor}
            />

            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.email ?? ''}
              onChangeText={(text) => updateContactField(index, 'email', text)}
              placeholder="correo@empresa.com"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <ThemedText style={styles.label}>Teléfono</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.phone ?? ''}
              onChangeText={(text) => updateContactField(index, 'phone', text)}
              placeholder="Teléfono"
              placeholderTextColor={placeholderColor}
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.label}>Celular</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.mobile ?? ''}
              onChangeText={(text) => updateContactField(index, 'mobile', text)}
              placeholder="Celular"
              placeholderTextColor={placeholderColor}
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.label}>Notas</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: inputBackground, color: inputTextColor, borderColor },
              ]}
              value={contact.notes ?? ''}
              onChangeText={(text) => updateContactField(index, 'notes', text)}
              placeholder="Notas"
              placeholderTextColor={placeholderColor}
              multiline
            />

            {contacts.length > 1 ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeContact(index)}>
                <ThemedText style={styles.removeButtonText}>Eliminar contacto</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addContact}>
          <ThemedText style={styles.addItemButtonText}>➕ Agregar contacto</ThemedText>
        </TouchableOpacity>
      </CollapsibleSection>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Guardar empresa</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 160,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    opacity: 0.75,
    marginBottom: 16,
  },
  sectionContainer: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHeaderDescription: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.7,
  },
  sectionHeaderIndicator: {
    fontSize: 20,
    marginLeft: 12,
  },
  sectionContent: {
    marginTop: 16,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  select: {
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  jsonInput: {
    minHeight: 120,
  },
  addItemButton: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  addItemButtonText: {
    fontSize: 16,
  },
  removeButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '500',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  coordinateInputsRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 12,
  },
  coordinateInputContainer: {
    flex: 1,
  },
  coordinateInput: {
    marginTop: 4,
  },
  coordinateLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '500',
  },
});
