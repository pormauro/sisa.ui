import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import CircleImagePicker from '@/components/CircleImagePicker';
import CompanyAddressesModal from '@/components/CompanyAddressesModal';
import CollapsibleSection from '@/components/CollapsibleSection';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { 
  CompaniesContext,
  Company,
  CompanyContact,
  TaxIdentity,
} from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';
import { analyzeAdministratorIdsInput } from '@/utils/administratorIds';
import { formatCompanyAddress } from '@/utils/address';

const IVA_OPTIONS = [
  { label: 'Responsable Inscripto', value: 'Responsable Inscripto' },
  { label: 'Responsable Monotributo', value: 'Responsable Monotributo' },
  { label: 'Exento', value: 'Exento' },
  { label: 'Consumidor Final', value: 'Consumidor Final' },
  { label: 'No Responsable', value: 'No Responsable' },
];

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

const identityValue = (company: Company | undefined, key: string) => {
  if (!company) return '';
  const direct = key === 'CUIT' ? company.tax_id : undefined;
  if (direct) {
    return direct;
  }
  const item = company.tax_identities.find(identity => identity.type === key);
  return item?.value ?? '';
};

const sanitizeContacts = (items: CompanyContact[]) =>
  items
    .map(contact => {
      const sanitized: CompanyContact = {
        name: contact.name.trim(),
        role: contact.role?.trim() || null,
        email: contact.email?.trim() || null,
        phone: contact.phone?.trim() || null,
        mobile: contact.mobile?.trim() || null,
        notes: contact.notes?.trim() || null,
      };

      if (contact.id !== undefined) {
        sanitized.id = contact.id;
      }
      if (contact.version !== undefined) {
        sanitized.version = contact.version;
      }

      return sanitized;
    })
    .filter(contact => contact.name || contact.email || contact.phone || contact.mobile);

const buildIdentitiesPayload = (
  taxId: string,
  ivaCondition: string,
  startDate: string,
  grossIncomeNumber: string,
  fiscalNotes: string,
  additionalIdentities: TaxIdentity[],
  existingIdentities: TaxIdentity[] = [],
) => {
  const findExisting = (type: string): Partial<TaxIdentity> => {
    const match = existingIdentities.find(identity => identity.type === type);
    if (!match) {
      return {};
    }
    const preserved: Partial<TaxIdentity> = {};
    if (match.id !== undefined) {
      preserved.id = match.id;
    }
    if (match.version !== undefined) {
      preserved.version = match.version;
    }
    if (match.country !== undefined) {
      preserved.country = match.country;
    }
    if (match.notes !== undefined) {
      preserved.notes = match.notes;
    }
    return preserved;
  };

  const baseIdentities: TaxIdentity[] = [];
  if (taxId.trim()) {
    baseIdentities.push({ type: 'CUIT', value: taxId.trim(), ...findExisting('CUIT') });
  }
  if (ivaCondition) {
    baseIdentities.push({ type: 'IVA_CONDITION', value: ivaCondition, ...findExisting('IVA_CONDITION') });
  }
  if (startDate.trim()) {
    baseIdentities.push({ type: 'START_DATE', value: startDate.trim(), ...findExisting('START_DATE') });
  }
  if (grossIncomeNumber.trim()) {
    baseIdentities.push({ type: 'GROSS_INCOME', value: grossIncomeNumber.trim(), ...findExisting('GROSS_INCOME') });
  }
  if (fiscalNotes.trim()) {
    baseIdentities.push({ type: 'FISCAL_NOTES', value: fiscalNotes.trim(), ...findExisting('FISCAL_NOTES') });
  }

  const dynamicIdentities = additionalIdentities
    .map(identity => {
      const sanitized: TaxIdentity = {
        type: identity.type.trim(),
        value: identity.value.trim(),
        country: identity.country?.trim() || null,
        notes: identity.notes?.trim() || null,
      };

      if (identity.id !== undefined) {
        sanitized.id = identity.id;
      }
      if (identity.version !== undefined) {
        sanitized.version = identity.version;
      }

      return sanitized;
    })
    .filter(identity => identity.type && identity.value);

  return [...baseIdentities, ...dynamicIdentities];
};

export default function EditCompanyPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(id);

  const { companies, loadCompanies, updateCompany, deleteCompany } = useContext(CompaniesContext);
  const { permissions } = useContext(PermissionsContext);
  const { normalizedUserId, isSuperAdministrator } = useSuperAdministrator();

  const company = companies.find(item => item.id === companyId);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const sectionBackground = useThemeColor({ light: '#f8f8f8', dark: '#1a1a1a' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const destructiveColor = useThemeColor({ light: '#d32f2f', dark: '#ff6b6b' }, 'button');

  const baseCanDelete = permissions.includes('deleteCompany');
  const companyAdministratorIds = useMemo(() => {
    if (!company || !Array.isArray(company.administrator_ids)) {
      return [] as string[];
    }
    return company.administrator_ids
      .map(adminId => String(adminId).trim())
      .filter((adminId): adminId is string => Boolean(adminId.length));
  }, [company]);
  const isListedAdministrator = useMemo(() => {
    if (!normalizedUserId) {
      return false;
    }
    if (!companyAdministratorIds.length) {
      return false;
    }
    return companyAdministratorIds.some(adminId => adminId === normalizedUserId);
  }, [companyAdministratorIds, normalizedUserId]);
  const actorIsAuthorized = isSuperAdministrator || isListedAdministrator;
  const canEdit = actorIsAuthorized;
  const canDelete = actorIsAuthorized && (baseCanDelete || isSuperAdministrator);
  const canAccess = actorIsAuthorized;

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

  const [contacts, setContacts] = useState<CompanyContact[]>([createEmptyContact()]);
  const [administratorIdsJson, setAdministratorIdsJson] = useState('[]');
  const [addressesModalVisible, setAddressesModalVisible] = useState(false);
  const administratorAnalysis = useMemo(
    () => analyzeAdministratorIdsInput(administratorIdsJson),
    [administratorIdsJson]
  );

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!companies.length) {
        void loadCompanies();
      }
    }, [companies.length, loadCompanies])
  );

  useEffect(() => {
    if (!company) {
      return;
    }

    if (!canAccess) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a esta empresa.');
      router.back();
      return;
    }

    setName(company.name);
    setLegalName(company.legal_name ?? '');
    setWebsite(company.website ?? '');
    setPhone(company.phone ?? '');
    setEmail(company.email ?? '');
    setStatus(company.status ?? '');
    setNotes(company.notes ?? '');
    setProfileFileId(company.profile_file_id ? String(company.profile_file_id) : null);

    setTaxId(identityValue(company, 'CUIT'));
    setIvaCondition(identityValue(company, 'IVA_CONDITION'));
    setStartDate(identityValue(company, 'START_DATE'));
    setGrossIncomeNumber(identityValue(company, 'GROSS_INCOME'));
    setFiscalNotes(identityValue(company, 'FISCAL_NOTES'));

    const dynamicIdentities = company.tax_identities.filter(identity =>
      !['CUIT', 'IVA_CONDITION', 'START_DATE', 'GROSS_INCOME', 'FISCAL_NOTES'].includes(identity.type)
    );
    setAdditionalIdentities(
      dynamicIdentities.length ? dynamicIdentities.map(identity => ({ ...identity })) : []
    );

    setContacts(company.contacts.length ? company.contacts.map(contact => ({ ...contact })) : [createEmptyContact()]);
    setAdministratorIdsJson(
      company.administrator_ids?.length ? JSON.stringify(company.administrator_ids) : '[]'
    );
  }, [canAccess, company, router]);

  useEffect(() => {
    if (!company && companies.length) {
      Alert.alert('No encontrado', 'No se pudo encontrar la empresa.');
      router.back();
    }
  }, [company, companies.length, router]);

  const ivaItems = useMemo(
    () => [{ label: 'Seleccionar condición IVA', value: '' }, ...IVA_OPTIONS],
    []
  );

  const updateContactField = (index: number, field: keyof CompanyContact, value: string) => {
    if (!canEdit) return;
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addContact = () => {
    if (!canEdit) return;
    setContacts(prev => [...prev, createEmptyContact()]);
  };

  const removeContact = (index: number) => {
    if (!canEdit) return;
    setContacts(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateIdentityField = (index: number, field: keyof TaxIdentity, value: string) => {
    if (!canEdit) return;
    setAdditionalIdentities(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addIdentity = () => {
    if (!canEdit) return;
    setAdditionalIdentities(prev => [...prev, createEmptyIdentity()]);
  };

  const removeIdentity = (index: number) => {
    if (!canEdit) return;
    setAdditionalIdentities(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAppendCurrentUser = () => {
    if (!canEdit) {
      return;
    }
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

  const handleUpdate = async () => {
    if (!company || !canEdit || submittingRef.current) {
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

    const payload = {
      name: name.trim(),
      administrator_ids: administratorAnalysis.ids,
      legal_name: legalName.trim() || null,
      tax_id: taxId.trim() || null,
      website: website.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      status: status.trim() || null,
      notes: notes.trim() || null,
      profile_file_id: profileFileId,
      tax_identities: buildIdentitiesPayload(
        taxId,
        ivaCondition,
        startDate,
        grossIncomeNumber,
        fiscalNotes,
        additionalIdentities,
        company.tax_identities,
      ),
      contacts: sanitizeContacts(contacts),
      version: company.version,
    };

    Alert.alert('Confirmar actualización', '¿Actualizar los datos de la empresa?', [
      { text: 'Cancelar', style: 'cancel', onPress: () => { submittingRef.current = false; } },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateCompany(companyId, payload);
          setLoading(false);
          submittingRef.current = false;
          if (success) {
            Alert.alert('Éxito', 'Empresa actualizada correctamente.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar la empresa.');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!company || !canDelete) {
      return;
    }

    Alert.alert('Confirmar eliminación', '¿Deseas eliminar esta empresa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteCompany(companyId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Empresa eliminada correctamente.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar la empresa.');
          }
        },
      },
    ]);
  };

  if (!company) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Buscando empresa...</ThemedText>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <ThemedText style={styles.sectionTitle}>Datos básicos</ThemedText>
      <ThemedText style={styles.helperText}>
        Solo el nombre comercial es obligatorio para actualizar la empresa.
      </ThemedText>
      <ThemedText style={styles.label}>Logo</ThemedText>
      <CircleImagePicker
        fileId={profileFileId}
        editable={canEdit}
        size={180}
        onImageChange={setProfileFileId}
      />

      <ThemedText style={styles.label}>Nombre Comercial *</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={canEdit ? setName : undefined}
        placeholder="Nombre comercial"
        placeholderTextColor={placeholderColor}
        editable={canEdit}
      />

      <CollapsibleSection
        title="Información comercial adicional"
        description="Razón social y datos de contacto"
        borderColor={borderColor}
        backgroundColor={sectionBackground}
      >
        <ThemedText style={styles.label}>Razón Social</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={legalName}
          onChangeText={canEdit ? setLegalName : undefined}
          placeholder="Razón social"
          placeholderTextColor={placeholderColor}
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Sitio Web</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={website}
          onChangeText={canEdit ? setWebsite : undefined}
          placeholder="https://empresa.com"
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Teléfono</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={phone}
          onChangeText={canEdit ? setPhone : undefined}
          placeholder="Teléfono principal"
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Email</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={email}
          onChangeText={canEdit ? setEmail : undefined}
          placeholder="contacto@empresa.com"
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Estado</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={status}
          onChangeText={canEdit ? setStatus : undefined}
          placeholder="Activo, Inactivo, etc."
          placeholderTextColor={placeholderColor}
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Notas</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={notes}
          onChangeText={canEdit ? setNotes : undefined}
          placeholder="Observaciones generales"
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={4}
          editable={canEdit}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Datos fiscales"
        description="CUIT, condición IVA e identificaciones extra"
        borderColor={borderColor}
        backgroundColor={sectionBackground}
      >
        <ThemedText style={styles.label}>CUIT</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={taxId}
          onChangeText={canEdit ? setTaxId : undefined}
          placeholder="00-00000000-0"
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Condición IVA</ThemedText>
        <SearchableSelect
          style={styles.select}
          items={ivaItems}
          selectedValue={ivaCondition}
          onValueChange={(value) => canEdit && setIvaCondition(String(value ?? ''))}
          placeholder="Seleccionar"
          disabled={!canEdit}
        />

        <ThemedText style={styles.label}>Inicio de Actividades</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={startDate}
          onChangeText={canEdit ? setStartDate : undefined}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={placeholderColor}
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Número de Ingresos Brutos</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
          value={grossIncomeNumber}
          onChangeText={canEdit ? setGrossIncomeNumber : undefined}
          placeholder="Número IIBB"
          placeholderTextColor={placeholderColor}
          editable={canEdit}
        />

        <ThemedText style={styles.label}>Notas fiscales</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={fiscalNotes}
          onChangeText={canEdit ? setFiscalNotes : undefined}
          placeholder="Información adicional"
          placeholderTextColor={placeholderColor}
          multiline
          editable={canEdit}
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
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Valor</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={identity.value}
              onChangeText={(text) => updateIdentityField(index, 'value', text)}
              placeholder="Valor"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>País</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={identity.country ?? ''}
              onChangeText={(text) => updateIdentityField(index, 'country', text)}
              placeholder="País"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
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
              editable={canEdit}
            />

            {canEdit ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeIdentity(index)}>
                <ThemedText style={styles.removeButtonText}>Eliminar identificación</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {canEdit ? (
          <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addIdentity}>
            <ThemedText style={styles.addItemButtonText}>➕ Agregar identificación</ThemedText>
          </TouchableOpacity>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title="Administradores"
        description="IDs de usuarios autorizados a editar"
        borderColor={borderColor}
        backgroundColor={sectionBackground}
      >
        <ThemedText style={styles.helperText}>
          Ingresá un array JSON con los IDs de usuario habilitados para editar esta empresa (ejemplo:
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
          onChangeText={canEdit ? setAdministratorIdsJson : undefined}
          placeholder='["12","98"]'
          placeholderTextColor={placeholderColor}
          editable={canEdit}
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
          style={[
            styles.secondaryButton,
            { borderColor },
            !canEdit ? styles.secondaryButtonDisabled : null,
          ]}
          onPress={handleAppendCurrentUser}
          activeOpacity={canEdit ? 0.85 : 1}
          disabled={!canEdit}
        >
          <ThemedText
            style={[
              styles.secondaryButtonText,
              !canEdit ? styles.secondaryButtonTextDisabled : null,
            ]}
          >
            Agregar mi usuario{normalizedUserId ? ` (${normalizedUserId})` : ''}
          </ThemedText>
        </TouchableOpacity>
      </CollapsibleSection>

      <CollapsibleSection
        title="Direcciones"
        description="Puntos físicos de contacto"
        borderColor={borderColor}
        backgroundColor={sectionBackground}
      >
        {company.addresses?.length ? (
          company.addresses.map((address, index) => (
            <View key={`address-summary-${address.id ?? index}`} style={[styles.addressSummaryCard, { borderColor }]}>
              <ThemedText style={styles.addressSummaryTitle}>
                {address.label?.trim() || `Dirección #${index + 1}`}
              </ThemedText>
              <ThemedText style={styles.addressSummaryText}>
                {formatCompanyAddress(address) || 'Sin datos suficientes'}
              </ThemedText>
              {address.is_primary ? (
                <ThemedText style={styles.addressSummaryBadge}>Principal</ThemedText>
              ) : null}
            </View>
          ))
        ) : (
          <ThemedText style={styles.helperText}>Aún no hay direcciones asociadas.</ThemedText>
        )}

        {canEdit ? (
          <TouchableOpacity
            style={[styles.addItemButton, { borderColor }]}
            onPress={() => setAddressesModalVisible(true)}
          >
            <ThemedText style={styles.addItemButtonText}>➕ Administrar direcciones</ThemedText>
          </TouchableOpacity>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title="Contactos"
        description="Personas de referencia y comunicación"
        borderColor={borderColor}
        backgroundColor={sectionBackground}
      >
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
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Cargo / Rol</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.role ?? ''}
              onChangeText={(text) => updateContactField(index, 'role', text)}
              placeholder="Cargo"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
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
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Teléfono</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.phone ?? ''}
              onChangeText={(text) => updateContactField(index, 'phone', text)}
              placeholder="Teléfono"
              placeholderTextColor={placeholderColor}
              keyboardType="phone-pad"
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Celular</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={contact.mobile ?? ''}
              onChangeText={(text) => updateContactField(index, 'mobile', text)}
              placeholder="Celular"
              placeholderTextColor={placeholderColor}
              keyboardType="phone-pad"
              editable={canEdit}
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
              editable={canEdit}
            />

            {canEdit && contacts.length > 1 ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeContact(index)}>
                <ThemedText style={styles.removeButtonText}>Eliminar contacto</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {canEdit ? (
          <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addContact}>
            <ThemedText style={styles.addItemButtonText}>➕ Agregar contacto</ThemedText>
          </TouchableOpacity>
        ) : null}
      </CollapsibleSection>

      <CompanyAddressesModal
        visible={addressesModalVisible}
        onClose={() => setAddressesModalVisible(false)}
        companyId={companyId}
        canEdit={canEdit}
        existingAddresses={company.addresses ?? []}
        onAddressesUpdated={loadCompanies}
      />

      {canEdit ? (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar empresa</ThemedText>
          )}
        </TouchableOpacity>
      ) : null}

      {canDelete ? (
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: destructiveColor }]}
          onPress={handleDelete}
          disabled={loading}
        >
          <ThemedText style={[styles.deleteButtonText, { color: destructiveColor }]}>Eliminar empresa</ThemedText>
        </TouchableOpacity>
      ) : null}
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
  addressSummaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addressSummaryTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  addressSummaryText: {
    fontSize: 14,
    marginBottom: 4,
  },
  addressSummaryBadge: {
    fontSize: 12,
    fontWeight: '600',
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
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  secondaryButtonTextDisabled: {
    opacity: 0.7,
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
  deleteButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
