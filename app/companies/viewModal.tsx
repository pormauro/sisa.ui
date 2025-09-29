import React, { useContext, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import FileGallery from '@/components/FileGallery';

export default function ViewCompanyModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(id);
  const router = useRouter();

  const { companies } = useContext(CompaniesContext);
  const company = companies.find(item => item.id === companyId);

  const background = useThemeColor({}, 'background');
  const cardBorder = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');

  const attachments = useMemo(() => {
    if (!company?.attached_files) {
      return '';
    }
    if (typeof company.attached_files === 'string') {
      return company.attached_files;
    }
    try {
      return JSON.stringify(company.attached_files);
    } catch {
      return '';
    }
  }, [company?.attached_files]);

  if (!company) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText>Empresa no encontrada</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <CircleImagePicker fileId={company.brand_file_id ? String(company.brand_file_id) : null} size={180} editable={false} />

      <ThemedText style={styles.sectionTitle}>Datos Generales</ThemedText>
      <ThemedText style={styles.label}>Nombre Comercial</ThemedText>
      <ThemedText style={styles.value}>{company.name}</ThemedText>

      {company.legal_name ? (
        <>
          <ThemedText style={styles.label}>Razón Social</ThemedText>
          <ThemedText style={styles.value}>{company.legal_name}</ThemedText>
        </>
      ) : null}

      {company.website ? (
        <>
          <ThemedText style={styles.label}>Sitio Web</ThemedText>
          <ThemedText style={styles.value}>{company.website}</ThemedText>
        </>
      ) : null}

      {company.phone ? (
        <>
          <ThemedText style={styles.label}>Teléfono</ThemedText>
          <ThemedText style={styles.value}>{company.phone}</ThemedText>
        </>
      ) : null}

      {company.email ? (
        <>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{company.email}</ThemedText>
        </>
      ) : null}

      {company.status ? (
        <>
          <ThemedText style={styles.label}>Estado</ThemedText>
          <ThemedText style={styles.value}>{company.status}</ThemedText>
        </>
      ) : null}

      {company.notes ? (
        <>
          <ThemedText style={styles.label}>Notas</ThemedText>
          <ThemedText style={styles.value}>{company.notes}</ThemedText>
        </>
      ) : null}

      <ThemedText style={styles.sectionTitle}>Identidad Fiscal</ThemedText>
      {company.tax_identities.length ? (
        <View style={[styles.card, { borderColor: cardBorder }]}>
          {company.tax_identities.map(identity => (
            <View key={`${identity.type}-${identity.value}`} style={styles.identityRow}>
              <ThemedText style={styles.identityType}>{identity.type}</ThemedText>
              <ThemedText style={styles.identityValue}>{identity.value}</ThemedText>
              {identity.country ? (
                <ThemedText style={styles.identityExtra}>País: {identity.country}</ThemedText>
              ) : null}
              {identity.notes ? (
                <ThemedText style={styles.identityExtra}>Notas: {identity.notes}</ThemedText>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <ThemedText style={styles.value}>Sin información fiscal registrada.</ThemedText>
      )}

      <ThemedText style={styles.sectionTitle}>Direcciones</ThemedText>
      {company.addresses.length ? (
        company.addresses.map(address => {
          const lines = [
            [address.street, address.number].filter(Boolean).join(' '),
            [address.floor, address.apartment].filter(Boolean).join(' '),
            [address.city, address.state, address.country].filter(Boolean).join(', '),
            address.postal_code,
          ].filter(line => line && line.trim().length);

          return (
            <View key={`${address.street}-${address.city}-${address.postal_code}`} style={[styles.card, { borderColor: cardBorder }]}>
              {lines.map((line, index) => (
                <ThemedText key={`addr-line-${index}`} style={styles.value}>{line}</ThemedText>
              ))}
              {address.notes ? (
                <ThemedText style={styles.identityExtra}>Notas: {address.notes}</ThemedText>
              ) : null}
            </View>
          );
        })
      ) : (
        <ThemedText style={styles.value}>Sin direcciones registradas.</ThemedText>
      )}

      <ThemedText style={styles.sectionTitle}>Contactos</ThemedText>
      {company.contacts.length ? (
        company.contacts.map(contact => (
          <View key={`${contact.name}-${contact.email}-${contact.phone}`} style={[styles.card, { borderColor: cardBorder }]}>
            <ThemedText style={styles.value}>{contact.name}</ThemedText>
            {contact.role ? <ThemedText style={styles.identityExtra}>Rol: {contact.role}</ThemedText> : null}
            {contact.email ? <ThemedText style={styles.identityExtra}>Email: {contact.email}</ThemedText> : null}
            {contact.phone ? <ThemedText style={styles.identityExtra}>Teléfono: {contact.phone}</ThemedText> : null}
            {contact.mobile ? <ThemedText style={styles.identityExtra}>Celular: {contact.mobile}</ThemedText> : null}
            {contact.notes ? <ThemedText style={styles.identityExtra}>Notas: {contact.notes}</ThemedText> : null}
          </View>
        ))
      ) : (
        <ThemedText style={styles.value}>Sin contactos registrados.</ThemedText>
      )}

      {attachments ? (
        <>
          <ThemedText style={styles.sectionTitle}>Adjuntos</ThemedText>
          <FileGallery filesJson={attachments} onChangeFilesJson={() => {}} editable={false} />
        </>
      ) : null}

      <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/companies/${company.id}`)}>
        <ThemedText style={styles.editButtonText}>Editar</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  sectionTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  identityRow: {
    marginBottom: 8,
  },
  identityType: {
    fontWeight: '600',
    fontSize: 14,
  },
  identityValue: {
    fontSize: 16,
    marginBottom: 2,
  },
  identityExtra: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
