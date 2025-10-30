import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import {
  CompanyMembershipsContext,
  CompanyMembership,
} from '@/contexts/CompanyMembershipsContext';
import FileGallery from '@/components/FileGallery';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';

const normalizeMembershipStatus = (status?: string | null): string => {
  if (!status) {
    return '';
  }
  return status.trim().toLowerCase();
};

const membershipIsPending = (status?: string | null): boolean => {
  const normalized = normalizeMembershipStatus(status);
  if (!normalized) {
    return false;
  }
  return normalized.includes('pend') || normalized.includes('solicit');
};

const membershipIsActive = (status?: string | null): boolean => {
  const normalized = normalizeMembershipStatus(status);
  if (!normalized) {
    return false;
  }
  return ['active', 'activo', 'habilitado', 'approved', 'aprobado', 'vigente'].some(keyword =>
    normalized.includes(keyword)
  );
};

const membershipIsRejected = (status?: string | null): boolean => {
  const normalized = normalizeMembershipStatus(status);
  if (!normalized) {
    return false;
  }
  return ['rechaz', 'deneg', 'declin', 'cancel'].some(keyword => normalized.includes(keyword));
};

type MembershipDecision = 'approve' | 'reject';

const MEMBERSHIP_STATUS_BY_DECISION: Record<MembershipDecision, string> = {
  approve: 'activo',
  reject: 'rechazado',
};

export default function ViewCompanyModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(id);
  const router = useRouter();

  const { companies } = useContext(CompaniesContext);
  const {
    memberships,
    loading: membershipsLoading,
    loadCompanyMemberships,
    requestMembershipAccess,
    updateMembershipStatus,
  } = useContext(CompanyMembershipsContext);
  const { permissions } = useContext(PermissionsContext);
  const { normalizedUserId, isSuperAdministrator } = useSuperAdministrator();
  const company = companies.find(item => item.id === companyId);

  const canView = permissions.includes('listCompanies') || permissions.includes('updateCompany');
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
  const canEdit =
    Boolean(company) &&
    (permissions.includes('updateCompany') || isSuperAdministrator) &&
    (isSuperAdministrator || isListedAdministrator);

  const [requestingAccess, setRequestingAccess] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const cardBorder = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const actionBackground = useThemeColor({}, 'button');
  const actionText = useThemeColor({}, 'buttonText');
  const destructiveBackground = useThemeColor({ light: '#d32f2f', dark: '#ff6b6b' }, 'button');
  const destructiveText = useThemeColor({ light: '#ffffff', dark: '#2f273e' }, 'buttonText');

  useEffect(() => {
    if (!canView) {
      return;
    }
    void loadCompanyMemberships();
  }, [canView, loadCompanyMemberships]);

  const numericUserId = useMemo(() => {
    if (!normalizedUserId) {
      return null;
    }
    const parsed = Number(normalizedUserId);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }, [normalizedUserId]);

  const companyMemberships = useMemo(() => {
    if (!Number.isFinite(companyId)) {
      return [] as CompanyMembership[];
    }
    return memberships.filter(item => item.company_id === companyId);
  }, [companyId, memberships]);

  const currentMembership = useMemo(() => {
    if (numericUserId === null) {
      return null;
    }
    return (
      companyMemberships.find(membership => membership.user_id === numericUserId) ?? null
    );
  }, [companyMemberships, numericUserId]);

  const pendingMemberships = useMemo(
    () => companyMemberships.filter(membership => membershipIsPending(membership.status)),
    [companyMemberships]
  );

  const activeMemberships = useMemo(
    () => companyMemberships.filter(membership => membershipIsActive(membership.status)),
    [companyMemberships]
  );

  const membershipStatusLabel = membershipsLoading
    ? 'Cargando...'
    : currentMembership
      ? currentMembership.status ?? 'Sin estado'
      : 'Sin acceso';

  const pendingCountLabel = membershipsLoading ? '—' : String(pendingMemberships.length);
  const activeCountLabel = membershipsLoading ? '—' : String(activeMemberships.length);

  const allowRequestAccess =
    numericUserId !== null &&
    (!currentMembership || membershipIsRejected(currentMembership.status));

  const handleRequestAccess = useCallback(async () => {
    if (!company || requestingAccess) {
      return;
    }

    if (currentMembership && !membershipIsRejected(currentMembership.status)) {
      Alert.alert('Acceso existente', 'Ya tenés una solicitud registrada para esta empresa.');
      return;
    }

    setRequestingAccess(true);
    try {
      const result = await requestMembershipAccess(company.id);

      if (!result) {
        Alert.alert(
          'No fue posible registrar la solicitud',
          'Intentá nuevamente más tarde o contactá a un administrador.'
        );
        return;
      }

      if (membershipIsPending(result.status)) {
        Alert.alert(
          'Solicitud enviada',
          'Notificamos a los administradores para que revisen tu acceso.'
        );
      } else if (membershipIsActive(result.status)) {
        Alert.alert('Acceso confirmado', 'Ya contás con acceso activo a esta empresa.');
      } else if (membershipIsRejected(result.status)) {
        Alert.alert(
          'Solicitud rechazada',
          'Tu solicitud fue marcada como rechazada. Te recomendamos contactar a un administrador para más detalles.'
        );
      } else {
        Alert.alert('Solicitud actualizada', 'Registramos tu solicitud de acceso.');
      }
    } catch (error) {
      console.error('Error requesting membership access:', error);
      Alert.alert('Error', 'No pudimos enviar tu solicitud. Intentá nuevamente en unos minutos.');
    } finally {
      setRequestingAccess(false);
    }
  }, [company, currentMembership, requestMembershipAccess, requestingAccess]);

  const performRespond = useCallback(
    async (membership: CompanyMembership, decision: MembershipDecision) => {
      const targetStatus = MEMBERSHIP_STATUS_BY_DECISION[decision];
      setRespondingId(membership.id);
      try {
        const ok = await updateMembershipStatus(membership.id, targetStatus);
        if (!ok) {
          Alert.alert(
            'No pudimos actualizar la solicitud',
            'Intentá nuevamente o revisá el módulo de membresías.'
          );
          return;
        }

        const successMessage =
          decision === 'approve'
            ? 'El usuario ahora cuenta con acceso a la empresa.'
            : 'La solicitud fue marcada como rechazada.';

        Alert.alert('Solicitud actualizada', successMessage);
      } catch (error) {
        console.error('Error responding to membership request:', error);
        Alert.alert('Error', 'No pudimos responder la solicitud. Intentalo nuevamente.');
      } finally {
        setRespondingId(null);
      }
    },
    [updateMembershipStatus]
  );

  const confirmRespond = useCallback(
    (membership: CompanyMembership, decision: MembershipDecision) => {
      const actionLabel = decision === 'approve' ? 'aprobar' : 'rechazar';
      Alert.alert(
        'Responder solicitud',
        `¿Querés ${actionLabel} el acceso de ${membership.user_name}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: decision === 'approve' ? 'Aprobar' : 'Rechazar',
            style: decision === 'reject' ? 'destructive' : 'default',
            onPress: () => void performRespond(membership, decision),
          },
        ]
      );
    },
    [performRespond]
  );

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

  const taxIdentities = company.tax_identities.filter(identity =>
    [identity.type, identity.value, identity.country, identity.notes].some(value =>
      Boolean(value && String(value).trim().length)
    )
  );

  const addressCards = company.addresses
    .map((address, index) => {
      const lines = [
        [address.street, address.number].filter(Boolean).join(' ').trim(),
        [address.floor, address.apartment].filter(Boolean).join(' ').trim(),
        [address.city, address.state, address.country].filter(Boolean).join(', ').trim(),
        address.postal_code?.trim(),
      ].filter(line => line && line.length);

      const notes = address.notes?.trim();

      if (!lines.length && !notes) {
        return null;
      }

      return (
        <View key={`address-${index}`} style={[styles.card, { borderColor: cardBorder }]}>
          {lines.map((line, lineIndex) => (
            <ThemedText key={`addr-line-${lineIndex}`} style={styles.value}>{line}</ThemedText>
          ))}
          {notes ? (
            <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText>
          ) : null}
        </View>
      );
    })
    .filter((card): card is React.ReactElement => Boolean(card));

  const contactCards = company.contacts
    .map((contact, index) => {
      const name = contact.name?.trim();
      const role = contact.role?.trim();
      const email = contact.email?.trim();
      const phone = contact.phone?.trim();
      const mobile = contact.mobile?.trim();
      const notes = contact.notes?.trim();

      const hasContent = [name, role, email, phone, mobile, notes].some(Boolean);

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
          {notes ? <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText> : null}
        </View>
      );
    })
    .filter((card): card is React.ReactElement => Boolean(card));

  const hasTaxIdentities = taxIdentities.length > 0;
  const hasAddresses = addressCards.length > 0;
  const hasContacts = contactCards.length > 0;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
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

      <View>
        <ThemedText style={styles.sectionTitle}>Accesos y membresías</ThemedText>
        <View style={[styles.card, styles.membershipCard, { borderColor: cardBorder }]}>
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Tu estado</ThemedText>
            <ThemedText style={styles.value}>{membershipStatusLabel}</ThemedText>
          </View>
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Solicitudes pendientes</ThemedText>
            <ThemedText style={styles.value}>{pendingCountLabel}</ThemedText>
          </View>
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Miembros activos</ThemedText>
            <ThemedText style={styles.value}>{activeCountLabel}</ThemedText>
          </View>
        </View>

        {currentMembership && membershipIsPending(currentMembership.status) ? (
          <ThemedText style={styles.membershipNotice}>
            Tu solicitud está pendiente de revisión.
          </ThemedText>
        ) : null}

        {currentMembership && membershipIsRejected(currentMembership.status) ? (
          <ThemedText style={styles.membershipNotice}>
            Tu última solicitud fue rechazada. Podés volver a solicitar acceso si corresponde.
          </ThemedText>
        ) : null}

        {allowRequestAccess ? (
          <TouchableOpacity
            style={[styles.requestButton, { backgroundColor: actionBackground }]}
            onPress={handleRequestAccess}
            disabled={requestingAccess}
            activeOpacity={0.85}
          >
            {requestingAccess ? (
              <ActivityIndicator color={actionText} />
            ) : (
              <ThemedText style={[styles.requestButtonText, { color: actionText }]}>
                Solicitar acceso
              </ThemedText>
            )}
          </TouchableOpacity>
        ) : null}

        {canEdit && pendingMemberships.length ? (
          <View style={[styles.pendingCard, { borderColor: cardBorder }]}>
            <ThemedText style={styles.pendingTitle}>Solicitudes pendientes</ThemedText>
            {pendingMemberships.map(pending => (
              <View key={`pending-${pending.id}`} style={styles.pendingRow}>
                <View style={styles.pendingInfo}>
                  <ThemedText style={styles.pendingName}>{pending.user_name}</ThemedText>
                  {pending.user_email ? (
                    <ThemedText style={styles.identityExtra}>{pending.user_email}</ThemedText>
                  ) : null}
                  {pending.notes ? (
                    <ThemedText style={styles.identityExtra}>{pending.notes}</ThemedText>
                  ) : null}
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: actionBackground }]}
                    onPress={() => confirmRespond(pending, 'approve')}
                    disabled={respondingId === pending.id}
                    activeOpacity={0.85}
                  >
                    {respondingId === pending.id ? (
                      <ActivityIndicator color={actionText} />
                    ) : (
                      <ThemedText style={[styles.actionButtonText, { color: actionText }]}>
                        Aprobar
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: destructiveBackground }]}
                    onPress={() => confirmRespond(pending, 'reject')}
                    disabled={respondingId === pending.id}
                    activeOpacity={0.85}
                  >
                    {respondingId === pending.id ? (
                      <ActivityIndicator color={destructiveText} />
                    ) : (
                      <ThemedText style={[styles.actionButtonText, { color: destructiveText }]}>
                        Rechazar
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

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
  membershipCard: {
    gap: 12,
  },
  membershipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membershipNotice: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  requestButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pendingInfo: {
    flex: 1,
    gap: 4,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: '600',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
