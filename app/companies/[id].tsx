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
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  CompaniesContext,
  Company,
  CompanyAddress,
  CompanyContact,
  TaxIdentity,
} from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { AuthContext } from '@/contexts/AuthContext';

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

const identityValue = (company: Company | undefined, key: string) => {
  if (!company) return '';
  const direct = key === 'CUIT' ? company.tax_id : undefined;
  if (direct) {
    return direct;
  }
  const item = company.tax_identities.find(identity => identity.type === key);
  return item?.value ?? '';
};

const sanitizeAddresses = (items: CompanyAddress[]) =>
  items
    .map(address => {
      const sanitized: CompanyAddress = {
        street: address.street.trim(),
        number: address.number?.toString().trim() || null,
        floor: address.floor?.toString().trim() || null,
        apartment: address.apartment?.toString().trim() || null,
        city: address.city?.toString().trim() || null,
        state: address.state?.toString().trim() || null,
        country: address.country?.toString().trim() || null,
        postal_code: address.postal_code?.toString().trim() || null,
        notes: address.notes?.toString().trim() || null,
      };

      if (address.id !== undefined) {
        sanitized.id = address.id;
      }
      if (address.version !== undefined) {
        sanitized.version = address.version;
      }

      return sanitized;
    })
    .filter(address => address.street || address.city || address.country);

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
  const { userId } = useContext(AuthContext);

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

  const baseCanEdit = permissions.includes('updateCompany');
  const baseCanDelete = permissions.includes('deleteCompany');
  const normalizedUserId = useMemo(() => {
    if (typeof userId !== 'string') {
      return null;
    }
    const trimmed = userId.trim();
    return trimmed.length ? trimmed : null;
  }, [userId]);
  const companyAdministratorIds = useMemo(() => {
    if (company && Array.isArray(company.administrator_ids)) {
      return company.administrator_ids;
    }
    return [] as string[];
  }, [company]);
  const isCompanyAdministrator = useMemo(() => {
    if (!normalizedUserId || !companyAdministratorIds.length) {
      return false;
    }
    return companyAdministratorIds.some(adminId => String(adminId).trim() === normalizedUserId);
  }, [companyAdministratorIds, normalizedUserId]);
  const canEdit = baseCanEdit && isCompanyAdministrator;
  const canDelete = baseCanDelete && isCompanyAdministrator;
  const canAccess = baseCanEdit || baseCanDelete;

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

    setAddresses(company.addresses.length ? company.addresses.map(address => ({ ...address })) : [createEmptyAddress()]);
    setContacts(company.contacts.length ? company.contacts.map(contact => ({ ...contact })) : [createEmptyContact()]);
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

  const updateAddressField = (index: number, field: keyof CompanyAddress, value: string) => {
    if (!canEdit) return;
    setAddresses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addAddress = () => {
    if (!canEdit) return;
    setAddresses(prev => [...prev, createEmptyAddress()]);
  };

  const removeAddress = (index: number) => {
    if (!canEdit) return;
    setAddresses(prev => prev.filter((_, idx) => idx !== index));
  };

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

    const payload = {
      name: name.trim(),
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
      addresses: sanitizeAddresses(addresses),
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
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Número</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.number ?? ''}
              onChangeText={(text) => updateAddressField(index, 'number', text)}
              placeholder="Número"
              placeholderTextColor={placeholderColor}
              keyboardType="numbers-and-punctuation"
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Piso</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.floor ?? ''}
              onChangeText={(text) => updateAddressField(index, 'floor', text)}
              placeholder="Piso"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Departamento</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.apartment ?? ''}
              onChangeText={(text) => updateAddressField(index, 'apartment', text)}
              placeholder="Departamento"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Ciudad</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.city ?? ''}
              onChangeText={(text) => updateAddressField(index, 'city', text)}
              placeholder="Ciudad"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Provincia / Estado</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.state ?? ''}
              onChangeText={(text) => updateAddressField(index, 'state', text)}
              placeholder="Provincia"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>País</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.country ?? ''}
              onChangeText={(text) => updateAddressField(index, 'country', text)}
              placeholder="País"
              placeholderTextColor={placeholderColor}
              editable={canEdit}
            />

            <ThemedText style={styles.label}>Código Postal</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              value={address.postal_code ?? ''}
              onChangeText={(text) => updateAddressField(index, 'postal_code', text)}
              placeholder="CP"
              placeholderTextColor={placeholderColor}
              keyboardType="numbers-and-punctuation"
              editable={canEdit}
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
              editable={canEdit}
            />

            {canEdit && addresses.length > 1 ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeAddress(index)}>
                <ThemedText style={styles.removeButtonText}>Eliminar dirección</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {canEdit ? (
          <TouchableOpacity style={[styles.addItemButton, { borderColor }]} onPress={addAddress}>
            <ThemedText style={styles.addItemButtonText}>➕ Agregar dirección</ThemedText>
          </TouchableOpacity>
        ) : null}
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
});
