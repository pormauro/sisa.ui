import React, { useContext, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';
import FileGallery from '@/components/FileGallery';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { toNumericCoordinate } from '@/utils/coordinates';

export default function ViewCompanyModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(id);
  const resolvedCompanyId = Number.isFinite(companyId) ? companyId : null;
  const router = useRouter();

  const { companies } = useContext(CompaniesContext);
  const { permissions } = useContext(PermissionsContext);
  const { normalizedUserId, isSuperAdministrator } = useSuperAdministrator();

  const company = companies.find(item => item.id === resolvedCompanyId);

  const administratorIds = useMemo(() => {
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
    if (!administratorIds.length) {
      return false;
    }
    return administratorIds.some(adminId => adminId === normalizedUserId);
  }, [administratorIds, normalizedUserId]);

  const canView =
    permissions.includes('listCompanies') ||
    permissions.includes('updateCompany') ||
    isListedAdministrator ||
    isSuperAdministrator;

  const canEdit = Boolean(company) && (isSuperAdministrator || isListedAdministrator);

  const background = useThemeColor({}, 'background');
  const cardBorder = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');

  if (!canView) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>No tienes permiso para ver esta empresa.</ThemedText>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Empresa no encontrada</ThemedText>
      </View>
    );
  }

  const generalFields = (
    [
      { label: 'Nombre Comercial', value: company.name },
      { label: 'Razón Social', value: company.legal_name },
      { label: 'Sitio Web', value: company.website },
      { label: 'Teléfono', value: company.phone },
      { label: 'Email', value: company.email },
      { label: 'Estado', value: company.status },
      { label: 'Notas', value: company.notes },
    ] as const
  )
    .map(field => ({
      label: field.label,
      value: typeof field.value === 'string' ? field.value.trim() : field.value,
    }))
    .filter(field => Boolean(field.value && String(field.value).trim().length));

  const taxIdentities = (company.tax_identities ?? []).filter(identity =>
    [identity.type, identity.value, identity.country, identity.notes].some(value =>
      Boolean(value && String(value).trim().length)
    )
  );

  const addressCards = (company.addresses ?? [])
    .map((address, index) => {
      const lines = [
        [address.street, address.number].filter(Boolean).join(' ').trim(),
        [address.floor, address.apartment].filter(Boolean).join(' ').trim(),
        [address.city, address.state, address.country].filter(Boolean).join(', ').trim(),
        address.postal_code?.trim(),
      ].filter(line => line && line.length);

      const notes = address.notes?.trim();
      const latitude = toNumericCoordinate(address.latitude);
      const longitude = toNumericCoordinate(address.longitude);
      const hasCoordinates = latitude !== null && longitude !== null;
      const title = address.label?.trim() || `Dirección #${index + 1}`;

      if (!lines.length && !notes && !hasCoordinates) {
        return null;
      }

      return (
        <View key={`address-${index}`} style={[styles.card, { borderColor: cardBorder }]}>
          <View style={styles.addressCardHeader}>
            <ThemedText style={styles.addressCardTitle}>{title}</ThemedText>
            {hasCoordinates ? (
              <View style={[styles.addressGpsBadge, { borderColor: cardBorder }]}>
                <IconSymbol name="mappin.circle.fill" size={16} color="#ff6b6b" />
              </View>
            ) : null}
          </View>
          {lines.map((line, lineIndex) => (
            <ThemedText key={`addr-line-${lineIndex}`} style={styles.value}>
              {line}
            </ThemedText>
          ))}
          {notes ? <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText> : null}
          {hasCoordinates ? (
            <ThemedText style={styles.identityExtra}>
              Coordenadas: {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
            </ThemedText>
          ) : null}
        </View>
      );
    })
    .filter((card): card is React.ReactElement => Boolean(card));

  const contactCards = (company.contacts ?? [])
    .map((contact, index) => {
      const name = contact.name?.trim();
      const role = contact.role?.trim();
      const email = contact.email?.trim();
      const phone = contact.phone?.trim();
      const mobile = contact.mobile?.trim();
      const notes = contact.notes?.trim();
      const channelLines = (contact.channels ?? [])
        .map(channel => {
          const value = channel.value?.trim();
          if (!value) {
            return null;
          }
          const labelParts = [channel.type?.trim(), channel.label?.trim()].filter(Boolean);
          const badges = [channel.is_primary ? 'Principal' : null, channel.verified ? 'Verificado' : null]
            .filter(Boolean)
            .join(' · ');
          const label = labelParts.join(' · ');
          const suffix = [label, badges].filter(Boolean).join(' · ');
          return suffix ? `${value} · ${suffix}` : value;
        })
        .filter((line): line is string => Boolean(line));

      const hasContent = [name, role, email, phone, mobile, notes, channelLines.length ? 'x' : ''].some(
        Boolean
      );

      if (!hasContent) {
        return null;
      }

      return (
        <View key={`contact-${index}`} style={[styles.card, { borderColor: cardBorder }]}>
          {name ? <ThemedText style={styles.value}>{name}</ThemedText> : null}
          {role ? <ThemedText style={styles.identityExtra}>Rol: {role}</ThemedText> : null}
          {email ? <ThemedText style={styles.identityExtra}>Email: {email}</ThemedText> : null}
          {phone ? <ThemedText style={styles.identityExtra}>Teléfono: {phone}</ThemedText> : null}
          {mobile ? <ThemedText style={styles.identityExtra}>Celular: {mobile}</ThemedText> : null}
          {channelLines.map((line, channelIndex) => (
            <ThemedText key={`contact-${index}-channel-${channelIndex}`} style={styles.identityExtra}>
              {line}
            </ThemedText>
          ))}
          {notes ? <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText> : null}
        </View>
      );
    })
    .filter((card): card is React.ReactElement => Boolean(card));

  const companyChannelCards = (company.channels ?? [])
    .map((channel, index) => {
      const value = channel.value?.trim();
      if (!value) {
        return null;
      }
      const typeLabel = channel.type?.trim();
      const friendlyLabel = channel.label?.trim();
      const badges = [channel.is_primary ? 'Principal' : null, channel.verified ? 'Verificado' : null]
        .filter(Boolean)
        .join(' · ');
      const description = [typeLabel, friendlyLabel, badges].filter(Boolean).join(' · ');
      return (
        <View key={`company-channel-${index}`} style={[styles.card, { borderColor: cardBorder }]}>
          <ThemedText style={styles.value}>{value}</ThemedText>
          {description ? <ThemedText style={styles.identityExtra}>{description}</ThemedText> : null}
        </View>
      );
    })
    .filter((card): card is React.ReactElement => Boolean(card));

  const attachments = (() => {
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
  })();

  const hasTaxIdentities = taxIdentities.length > 0;
  const hasAddresses = addressCards.length > 0;
  const hasContacts = contactCards.length > 0;
  const hasCompanyChannels = companyChannelCards.length > 0;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <CircleImagePicker
        fileId={company.profile_file_id ? String(company.profile_file_id) : null}
        size={180}
        editable={false}
      />

      {generalFields.length ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Datos Generales</ThemedText>
          {generalFields.map(field => (
            <React.Fragment key={field.label}>
              <ThemedText style={styles.label}>{field.label}</ThemedText>
              <ThemedText style={styles.value}>{String(field.value)}</ThemedText>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {hasTaxIdentities ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Identidad Fiscal</ThemedText>
          <View style={[styles.card, { borderColor: cardBorder }]}>
            {taxIdentities.map((identity, index) => {
              const type = identity.type?.trim();
              const value = identity.value?.trim();
              const country = identity.country?.trim();
              const notes = identity.notes?.trim();

              return (
                <View key={`identity-${index}`} style={styles.identityRow}>
                  {type ? <ThemedText style={styles.identityType}>{type}</ThemedText> : null}
                  {value ? <ThemedText style={styles.identityValue}>{value}</ThemedText> : null}
                  {country ? (
                    <ThemedText style={styles.identityExtra}>País: {country}</ThemedText>
                  ) : null}
                  {notes ? (
                    <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasAddresses ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Direcciones</ThemedText>
          {addressCards}
        </View>
      ) : null}

      {hasCompanyChannels ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Canales de contacto</ThemedText>
          {companyChannelCards}
        </View>
      ) : null}

      {hasContacts ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Contactos</ThemedText>
          {contactCards}
        </View>
      ) : null}

      {attachments ? (
        <View>
          <ThemedText style={styles.sectionTitle}>Adjuntos</ThemedText>
          <FileGallery filesJson={attachments} onChangeFilesJson={() => {}} editable={false} />
        </View>
      ) : null}

      {canEdit ? (
        <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/companies/${company.id}`)}>
          <ThemedText style={styles.editButtonText}>Editar</ThemedText>
        </TouchableOpacity>
      ) : null}
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
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addressGpsBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  identityExtra: {
    fontSize: 14,
    color: '#666',
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
