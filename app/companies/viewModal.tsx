import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import {
  CompanyMembershipsContext,
  CompanyMembership,
  MembershipDecision,
} from '@/contexts/CompanyMembershipsContext';
import FileGallery from '@/components/FileGallery';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';
import { toNumericCoordinate } from '@/utils/coordinates';
import { MembershipStatusBadge } from '@/components/MembershipStatusBadge';
import {
  MembershipLifecycleStatus,
  getMembershipStatusMetadata,
  normalizeMembershipStatus as normalizeLifecycleStatus,
  isApprovedMembershipStatus,
  isPendingMembershipStatus,
  isRejectedMembershipStatus,
} from '@/constants/companyMemberships';

type NormalizableStatusCandidate =
  | { status?: string | null; normalized_status?: MembershipLifecycleStatus | null }
  | string
  | null
  | undefined;

const resolveLifecycleStatus = (
  candidate: NormalizableStatusCandidate
): MembershipLifecycleStatus | null => {
  if (!candidate) {
    return null;
  }
  if (typeof candidate === 'string') {
    return normalizeLifecycleStatus(candidate);
  }
  return candidate.normalized_status ?? normalizeLifecycleStatus(candidate.status ?? '');
};

const membershipIsPending = (candidate: NormalizableStatusCandidate): boolean =>
  isPendingMembershipStatus(resolveLifecycleStatus(candidate));

const membershipIsApproved = (candidate: NormalizableStatusCandidate): boolean =>
  isApprovedMembershipStatus(resolveLifecycleStatus(candidate));

const membershipIsRejected = (candidate: NormalizableStatusCandidate): boolean =>
  isRejectedMembershipStatus(resolveLifecycleStatus(candidate));

const MEMBERSHIP_STATUS_BY_DECISION: Record<MembershipDecision, MembershipLifecycleStatus> = {
  approve: 'approved',
  reject: 'rejected',
};

type ResponseTemplateId = 'approval_default' | 'rejection_missing_docs' | 'more_info_default';

interface ResponseTemplate {
  id: ResponseTemplateId;
  label: string;
  description: string;
  decision: MembershipDecision | null;
  status: MembershipLifecycleStatus;
  defaultMessage: string;
  defaultReason?: string | null;
  defaultNotes?: string | null;
  requireReason?: boolean;
  requireNotes?: boolean;
  channel: string;
  ctaLabel: string;
}

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    id: 'approval_default',
    label: 'Aprobación inmediata',
    description: 'Activa el acceso y envía un mensaje de bienvenida.',
    decision: 'approve',
    status: 'approved',
    defaultMessage:
      'Hola {{user}}, aprobamos tu acceso a {{company}}. Ya podés operar desde la app.',
    defaultNotes: 'Alta confirmada desde la vista de empresas.',
    channel: 'in-app',
    ctaLabel: 'Aprobar y notificar',
  },
  {
    id: 'rejection_missing_docs',
    label: 'Rechazo (falta info)',
    description: 'Informa que faltan datos/documentos para avanzar.',
    decision: 'reject',
    status: 'rejected',
    defaultMessage:
      'Hola {{user}}, no pudimos aprobar tu acceso porque faltan documentos. Completá los datos y volvé a intentarlo.',
    defaultReason: 'Documentación incompleta',
    defaultNotes: 'Rechazo registrado por información insuficiente.',
    requireReason: true,
    requireNotes: true,
    channel: 'in-app',
    ctaLabel: 'Rechazar y notificar',
  },
  {
    id: 'more_info_default',
    label: 'Pedir más información',
    description: 'Mantiene la solicitud en revisión y pide datos extra.',
    decision: null,
    status: 'pending',
    defaultMessage:
      'Hola {{user}}, necesitamos información adicional para validar tu acceso a {{company}}. Respondé este mensaje con los datos solicitados.',
    defaultReason: 'Información adicional solicitada',
    defaultNotes: 'Pendiente hasta recibir documentación complementaria.',
    requireNotes: true,
    channel: 'in-app',
    ctaLabel: 'Enviar consulta',
  },
];

const RESPONSE_TEMPLATE_MAP = new Map<ResponseTemplateId, ResponseTemplate>(
  RESPONSE_TEMPLATES.map(template => [template.id, template])
);

const DEFAULT_RESPONSE_TEMPLATE_ID: ResponseTemplateId = 'approval_default';

const QUICK_REQUEST_TEMPLATE = {
  id: 'company-view:auto-request',
  label: 'Solicitud rápida desde empresas',
  message: 'Necesito que habiliten mi acceso a esta empresa desde la vista detallada.',
};

type ResponseComposerState = {
  templateId: ResponseTemplateId;
  message: string;
  reason: string;
  notes: string;
};

const fillTemplatePlaceholders = (
  templateText: string,
  membership: CompanyMembership | null,
  companyName?: string | null
): string => {
  if (!templateText) {
    return '';
  }

  const fallbackUser = membership?.user_name?.trim() || 'la persona solicitante';
  const fallbackCompany = companyName?.trim() || membership?.company_name || 'la empresa';

  return templateText
    .replace(/\{\{\s*user\s*\}\}/gi, fallbackUser)
    .replace(/\{\{\s*company\s*\}\}/gi, fallbackCompany);
};

const resolveResponseTemplate = (templateId?: ResponseTemplateId | null): ResponseTemplate => {
  return RESPONSE_TEMPLATE_MAP.get(templateId ?? DEFAULT_RESPONSE_TEMPLATE_ID) ?? RESPONSE_TEMPLATES[0];
};

const getTimestamp = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const formatDateTime = (value?: string | null): string | null => {
  const timestamp = getTimestamp(value);
  if (!timestamp) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(new Date(timestamp));
};

const formatDuration = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '—';
  }
  const minutes = milliseconds / (1000 * 60);
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} d`;
};

const getErrorStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const candidate = (error as { status?: unknown }).status;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return Math.trunc(candidate);
  }
  if (typeof candidate === 'string' && candidate.trim().length) {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

const getErrorMessageText = (error: unknown): string | null => {
  if (error instanceof Error) {
    const trimmed = error.message?.trim();
    return trimmed && trimmed.length ? trimmed : null;
  }
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

const showMembershipErrorAlert = (error: unknown, fallbackMessage: string) => {
  const status = getErrorStatusCode(error);
  const message = getErrorMessageText(error);

  if (status === 401) {
    Alert.alert('Sesión expirada', 'Tu sesión expiró. Iniciá sesión nuevamente para continuar.');
    return;
  }

  if (status === 422) {
    Alert.alert(
      'Datos inválidos',
      message ?? 'Revisá la información enviada e intentá nuevamente.'
    );
    return;
  }

  Alert.alert('Error', fallbackMessage);
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
  const resolvedCompanyName = company?.name ?? company?.legal_name ?? null;

  const canView =
    permissions.includes('listCompanies') ||
    permissions.includes('updateCompany') ||
    isListedAdministrator ||
    isSuperAdministrator;
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
  const canEdit = Boolean(company) && (isSuperAdministrator || isListedAdministrator);

  const [requestingAccess, setRequestingAccess] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseForms, setResponseForms] = useState<Record<number, ResponseComposerState>>({});

  const background = useThemeColor({}, 'background');
  const cardBorder = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const actionBackground = useThemeColor({}, 'button');
  const actionText = useThemeColor({}, 'buttonText');
  const destructiveBackground = useThemeColor({ light: '#d32f2f', dark: '#ff6b6b' }, 'button');
  const destructiveText = useThemeColor({ light: '#ffffff', dark: '#2f273e' }, 'buttonText');
  const inputBackground = useThemeColor({ light: '#ffffff', dark: '#1c1c1c' }, 'background');
  const inputBorder = useThemeColor({ light: '#d0d0d0', dark: '#555555' }, 'background');
  const inputText = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#9e9e9e', dark: '#aaaaaa' }, 'text');
  const errorBorder = useThemeColor({ light: '#c62828', dark: '#ef9a9a' }, 'text');
  const summaryBackground = useThemeColor({ light: '#f5f7ff', dark: '#1b1f2a' }, 'background');

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
    () => companyMemberships.filter(membership => membershipIsPending(membership)),
    [companyMemberships]
  );

  const activeMemberships = useMemo(
    () => companyMemberships.filter(membership => membershipIsApproved(membership)),
    [companyMemberships]
  );

  const currentLifecycleStatus = useMemo(
    () => resolveLifecycleStatus(currentMembership ?? null),
    [currentMembership]
  );

  const membershipStatusMeta = useMemo(
    () => getMembershipStatusMetadata(currentLifecycleStatus ?? undefined),
    [currentLifecycleStatus]
  );

  const membershipStatusLabel = membershipsLoading
    ? 'Cargando...'
    : currentMembership
      ? membershipStatusMeta?.label ?? currentMembership.status ?? 'Sin estado'
      : 'Sin acceso';

  const pendingCountLabel = membershipsLoading ? '—' : String(pendingMemberships.length);
  const activeCountLabel = membershipsLoading ? '—' : String(activeMemberships.length);

  const allowRequestAccess =
    numericUserId !== null && (!currentMembership || membershipIsRejected(currentMembership));

  const buildResponseComposerState = useCallback(
    (
      membership: CompanyMembership,
      templateId: ResponseTemplateId = DEFAULT_RESPONSE_TEMPLATE_ID
    ): ResponseComposerState => {
      const template = resolveResponseTemplate(templateId);
      return {
        templateId: template.id,
        message: fillTemplatePlaceholders(template.defaultMessage, membership, resolvedCompanyName),
        reason: template.defaultReason
          ? fillTemplatePlaceholders(template.defaultReason, membership, resolvedCompanyName)
          : '',
        notes: template.defaultNotes
          ? fillTemplatePlaceholders(template.defaultNotes, membership, resolvedCompanyName)
          : '',
      };
    },
    [resolvedCompanyName]
  );

  const patchResponseComposer = useCallback(
    (
      membership: CompanyMembership,
      updater: (current: ResponseComposerState) => ResponseComposerState
    ) => {
      setResponseForms(prev => {
        const current = prev[membership.id] ?? buildResponseComposerState(membership);
        const next = updater(current);
        if (
          current.templateId === next.templateId &&
          current.message === next.message &&
          current.reason === next.reason &&
          current.notes === next.notes
        ) {
          return prev;
        }
        return { ...prev, [membership.id]: next };
      });
    },
    [buildResponseComposerState]
  );

  const handleTemplateChange = useCallback(
    (membership: CompanyMembership, templateId: ResponseTemplateId) => {
      patchResponseComposer(membership, () => buildResponseComposerState(membership, templateId));
    },
    [buildResponseComposerState, patchResponseComposer]
  );

  const handleComposerValueChange = useCallback(
    (membership: CompanyMembership, field: 'message' | 'reason' | 'notes', value: string) => {
      patchResponseComposer(membership, current => ({ ...current, [field]: value }));
    },
    [patchResponseComposer]
  );

  const getResponseComposerState = useCallback(
    (membership: CompanyMembership): ResponseComposerState => {
      return responseForms[membership.id] ?? buildResponseComposerState(membership);
    },
    [buildResponseComposerState, responseForms]
  );

  const handleSendResponse = useCallback(
    (membership: CompanyMembership) => {
      const composer = responseForms[membership.id] ?? buildResponseComposerState(membership);
      const template = resolveResponseTemplate(composer.templateId);
      const trimmedMessage = composer.message.trim();
      const trimmedNotes = composer.notes.trim();
      const trimmedReason = composer.reason.trim();

      if (!trimmedMessage.length) {
        Alert.alert('Mensaje requerido', 'Completá el mensaje que recibirá el solicitante.');
        return;
      }

      if (template.requireReason && !trimmedReason.length) {
        Alert.alert('Motivo requerido', 'Indicá el motivo del rechazo antes de continuar.');
        return;
      }

      if (template.requireNotes && !trimmedNotes.length) {
        Alert.alert(
          'Observaciones obligatorias',
          'Registrá observaciones internas para dejar trazabilidad de la decisión.'
        );
        return;
      }

      const submit = async () => {
        setRespondingId(membership.id);
        try {
          const targetStatus = template.decision
            ? MEMBERSHIP_STATUS_BY_DECISION[template.decision]
            : template.status ?? membership.status ?? 'pending';
          const updated = await updateMembershipStatus(membership.id, targetStatus, {
            decision: template.decision ?? undefined,
            role: membership.role ?? null,
            notes: trimmedNotes.length ? trimmedNotes : null,
            reason: trimmedReason.length ? trimmedReason : null,
            response_template: template.id,
            response_template_label: template.label,
            response_message: trimmedMessage,
            response_channel: template.channel,
            response_summary: template.description,
            message: membership.message ?? null,
          });

          if (!updated) {
            Alert.alert(
              'No pudimos actualizar la solicitud',
              'Intentá nuevamente o revisá el módulo de membresías.'
            );
            return;
          }

          if (membershipIsPending(updated) && template.decision === null) {
            Alert.alert('Consulta enviada', 'Registramos tu mensaje y la solicitud sigue pendiente.');
          } else if (membershipIsApproved(updated)) {
            Alert.alert('Solicitud aprobada', 'El usuario ahora cuenta con acceso activo a la empresa.');
          } else if (membershipIsRejected(updated)) {
            Alert.alert(
              'Solicitud rechazada',
              'La solicitud fue marcada como rechazada y notificamos al solicitante.'
            );
          } else {
            Alert.alert('Solicitud actualizada', 'Actualizamos el estado de la solicitud.');
          }
        } catch (error) {
          console.error('Error responding to membership request:', error);
          showMembershipErrorAlert(
            error,
            'No pudimos enviar la notificación. Intentalo nuevamente.'
          );
        } finally {
          setRespondingId(null);
        }
      };

      if (template.decision === 'reject') {
        Alert.alert('Confirmar rechazo', `¿Querés rechazar el acceso de ${membership.user_name}?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Rechazar', style: 'destructive', onPress: () => void submit() },
        ]);
        return;
      }

      void submit();
    },
    [buildResponseComposerState, responseForms, updateMembershipStatus]
  );

  const handleRequestAccess = useCallback(async () => {
    if (!company || requestingAccess) {
      return;
    }

      if (currentMembership && !membershipIsRejected(currentMembership)) {
        Alert.alert('Acceso existente', 'Ya tenés una solicitud registrada para esta empresa.');
        return;
    }

    setRequestingAccess(true);
    try {
      const defaultMessage = fillTemplatePlaceholders(
        QUICK_REQUEST_TEMPLATE.message,
        currentMembership,
        resolvedCompanyName
      );
      const result = await requestMembershipAccess(company.id, {
        message: defaultMessage,
        request_template: QUICK_REQUEST_TEMPLATE.id,
        request_template_label: QUICK_REQUEST_TEMPLATE.label,
      });

      if (!result) {
        Alert.alert(
          'No fue posible registrar la solicitud',
          'Intentá nuevamente más tarde o contactá a un administrador.'
        );
        return;
      }

      if (membershipIsPending(result)) {
        Alert.alert(
          'Solicitud enviada',
          'Notificamos a los administradores para que revisen tu acceso.'
        );
      } else if (membershipIsApproved(result)) {
        Alert.alert('Acceso confirmado', 'Ya contás con acceso activo a esta empresa.');
      } else if (membershipIsRejected(result)) {
        Alert.alert(
          'Solicitud rechazada',
          'Tu solicitud fue marcada como rechazada. Te recomendamos contactar a un administrador para más detalles.'
        );
      } else {
        Alert.alert('Solicitud actualizada', 'Registramos tu solicitud de acceso.');
      }
    } catch (error) {
      console.error('Error requesting membership access:', error);
      showMembershipErrorAlert(
        error,
        'No pudimos enviar tu solicitud. Intentá nuevamente en unos minutos.'
      );
    } finally {
      setRequestingAccess(false);
    }
  }, [
    company,
    currentMembership,
    requestMembershipAccess,
    requestingAccess,
    resolvedCompanyName,
  ]);

  const membershipRoleSummary = useMemo(() => {
    if (!companyMemberships.length) {
      return [] as { label: string; count: number }[];
    }
    const counts = new Map<string, number>();
    companyMemberships.forEach(item => {
      const label = item.role?.trim() || 'Sin rol asignado';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [companyMemberships]);

  const membershipStatusSummary = useMemo(() => {
    if (!companyMemberships.length) {
      return [] as {
        key: string;
        label: string;
        count: number;
        order: number;
      }[];
    }
    const counts = new Map<string, {
      count: number;
      normalized: MembershipLifecycleStatus | null;
    }>();
    companyMemberships.forEach(item => {
      const normalized = resolveLifecycleStatus(item);
      const key = normalized ?? 'unknown';
      const record = counts.get(key) ?? { count: 0, normalized };
      record.count += 1;
      record.normalized = normalized;
      counts.set(key, record);
    });
    return Array.from(counts.entries())
      .map(([key, record]) => {
        const metadata = getMembershipStatusMetadata(record.normalized ?? undefined);
        return {
          key,
          label: metadata?.label ?? 'Sin estado',
          count: record.count,
          order: metadata?.order ?? 99,
        };
      })
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [companyMemberships]);

  const historicalKpis = useMemo(() => {
    const resolved = companyMemberships.filter(
      membership => getTimestamp(membership.responded_at) !== null
    );
    const sortedResolved = resolved
      .slice()
      .sort((a, b) => (getTimestamp(b.responded_at) ?? 0) - (getTimestamp(a.responded_at) ?? 0));
    const lastResolvedLabel = sortedResolved.length
      ? formatDateTime(sortedResolved[0].responded_at) ?? '—'
      : 'Sin registros';
    const durations = resolved
      .map(membership => {
        const created = getTimestamp(membership.created_at);
        const respondedAt = getTimestamp(membership.responded_at);
        if (created === null || respondedAt === null) {
          return null;
        }
        return Math.max(respondedAt - created, 0);
      })
      .filter((value): value is number => Number.isFinite(value) && value !== null);
    const averageResponseLabel = durations.length
      ? formatDuration(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : '—';
    const lastResolvedBy = sortedResolved[0]?.responded_by_name?.trim();
    return [
      {
        key: 'lastResolved',
        label: 'Última solicitud atendida',
        value: lastResolvedLabel,
        hint: lastResolvedBy ? `Por ${lastResolvedBy}` : undefined,
      },
      {
        key: 'avgResponse',
        label: 'Tiempo promedio de respuesta',
        value: averageResponseLabel,
        hint: durations.length ? `${durations.length} registros` : undefined,
      },
      {
        key: 'pendingActive',
        label: 'Pendientes vs activos',
        value: `${pendingMemberships.length} / ${activeMemberships.length}`,
        hint: 'Pendientes / activos',
      },
    ];
  }, [companyMemberships, pendingMemberships.length, activeMemberships.length]);

  const membershipTimelineItems = useMemo(() => {
    if (!companyMemberships.length) {
      return [] as CompanyMembership[];
    }
    return companyMemberships
      .slice()
      .sort((a, b) => {
        const aTimestamp = getTimestamp(a.updated_at) ?? getTimestamp(a.created_at) ?? 0;
        const bTimestamp = getTimestamp(b.updated_at) ?? getTimestamp(b.created_at) ?? 0;
        return bTimestamp - aTimestamp;
      });
  }, [companyMemberships]);

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
                <IconSymbol name="mappin.circle.fill" size={16} color={actionBackground} />
              </View>
            ) : null}
          </View>
          {lines.map((line, lineIndex) => (
            <ThemedText key={`addr-line-${lineIndex}`} style={styles.value}>{line}</ThemedText>
          ))}
          {notes ? (
            <ThemedText style={styles.identityExtra}>Notas: {notes}</ThemedText>
          ) : null}
          {hasCoordinates ? (
            <ThemedText style={styles.identityExtra}>
              Coordenadas: {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
            </ThemedText>
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

      const hasContent = [name, role, email, phone, mobile, notes, channelLines.length ? 'x' : ''].some(Boolean);

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

  const companyChannelCards = company.channels
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

  const hasTaxIdentities = taxIdentities.length > 0;
  const hasAddresses = addressCards.length > 0;
  const hasContacts = contactCards.length > 0;
  const hasCompanyChannels = companyChannelCards.length > 0;


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
        <View style={[styles.card, styles.membershipAnalyticsPanel, { borderColor: cardBorder }]}>
          <View style={styles.analyticsRow}>
            <View style={styles.analyticsColumn}>
              <ThemedText style={styles.analyticsTitle}>Roles detectados</ThemedText>
              <View style={styles.chipGroup}>
                {membershipRoleSummary.length ? (
                  membershipRoleSummary.map(role => (
                    <View key={`role-chip-${role.label}`} style={styles.chip}>
                      <ThemedText style={styles.chipLabel}>{role.label}</ThemedText>
                      <ThemedText style={styles.chipValue}>{role.count}</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.membershipNotice}>Sin roles registrados.</ThemedText>
                )}
              </View>
            </View>
            <View style={styles.analyticsColumn}>
              <ThemedText style={styles.analyticsTitle}>Estados</ThemedText>
              <View style={styles.chipGroup}>
                {membershipStatusSummary.length ? (
                  membershipStatusSummary.map(status => (
                    <View key={`status-chip-${status.key}`} style={styles.chip}>
                      <ThemedText style={styles.chipLabel}>{status.label}</ThemedText>
                      <ThemedText style={styles.chipValue}>{status.count}</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.membershipNotice}>Sin estados registrados.</ThemedText>
                )}
              </View>
            </View>
          </View>
          <View style={styles.kpiRow}>
            {historicalKpis.map(kpi => (
              <View key={kpi.key} style={styles.kpiCard}>
                <ThemedText style={styles.kpiLabel}>{kpi.label}</ThemedText>
                <ThemedText style={styles.kpiValue}>{kpi.value}</ThemedText>
                {kpi.hint ? <ThemedText style={styles.kpiHint}>{kpi.hint}</ThemedText> : null}
              </View>
            ))}
          </View>
          <View style={styles.memberNavigationGrid}>
            {companyMemberships.length ? (
              companyMemberships.map(member => (
                <TouchableOpacity
                  key={`member-link-${member.id}`}
                  style={[styles.memberNavigationButton, { borderColor: cardBorder }]}
                  onPress={() => router.push(`/company_memberships/${member.id}`)}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.memberNavigationLabel}>{member.user_name}</ThemedText>
                  {member.role ? (
                    <ThemedText style={styles.memberNavigationSubLabel}>{member.role}</ThemedText>
                  ) : null}
                </TouchableOpacity>
              ))
            ) : (
              <ThemedText style={styles.membershipNotice}>
                Todavía no hay miembros registrados.
              </ThemedText>
            )}
          </View>
        </View>

        <View style={[styles.card, styles.membershipStatusCard, { borderColor: cardBorder }]}>
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Tu estado</ThemedText>
            <MembershipStatusBadge
              normalizedStatus={currentLifecycleStatus}
              fallbackLabel={membershipStatusLabel}
              size="sm"
            />
          </View>
          {membershipStatusMeta?.description ? (
            <ThemedText style={styles.membershipNotice}>{membershipStatusMeta.description}</ThemedText>
          ) : null}
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Solicitudes pendientes</ThemedText>
            <ThemedText style={styles.value}>{pendingCountLabel}</ThemedText>
          </View>
          <View style={styles.membershipRow}>
            <ThemedText style={styles.label}>Miembros activos</ThemedText>
            <ThemedText style={styles.value}>{activeCountLabel}</ThemedText>
          </View>
        </View>

        {currentMembership && membershipIsPending(currentMembership) ? (
          <ThemedText style={styles.membershipNotice}>
            Tu solicitud está pendiente de revisión.
          </ThemedText>
        ) : null}

        {currentMembership && membershipIsRejected(currentMembership) ? (
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

        <View style={[styles.card, styles.timelineContainer, { borderColor: cardBorder }]}
        >
          <View style={styles.timelineHeaderRow}>
            <ThemedText style={styles.analyticsTitle}>Actividad reciente</ThemedText>
            {membershipsLoading ? <ActivityIndicator /> : null}
          </View>
          {membershipTimelineItems.length ? (
            <FlatList
              data={membershipTimelineItems}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => {
                const normalizedStatus = resolveLifecycleStatus(item);
                const updatedLabel =
                  formatDateTime(item.updated_at) ?? formatDateTime(item.created_at) ?? 'Sin fecha';
                const canQuickRespond = canEdit && membershipIsPending(item);
                const composer = canQuickRespond ? getResponseComposerState(item) : null;
                const selectedTemplate = composer
                  ? resolveResponseTemplate(composer.templateId)
                  : null;
                const messageError = Boolean(composer && !composer.message.trim().length);
                const reasonError = Boolean(
                  composer &&
                    selectedTemplate?.requireReason &&
                    !composer.reason.trim().length
                );
                const notesError = Boolean(
                  composer && selectedTemplate?.requireNotes && !composer.notes.trim().length
                );
                const responseMessage = item.response_message?.trim();
                let responseTemplateLabel = item.response_template_label?.trim() ?? null;
                if (!responseTemplateLabel && item.response_template) {
                  const fallback = RESPONSE_TEMPLATE_MAP.get(
                    item.response_template as ResponseTemplateId
                  );
                  if (fallback) {
                    responseTemplateLabel = fallback.label;
                  }
                }
                const responseChannel = item.response_channel?.trim();
                const responseSummary = item.response_summary?.trim();
                return (
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <View style={styles.timelineUserBlock}>
                        <ThemedText style={styles.timelineName}>{item.user_name}</ThemedText>
                        {item.role ? (
                          <ThemedText style={styles.timelineRole}>{item.role}</ThemedText>
                        ) : null}
                      </View>
                      <MembershipStatusBadge
                        normalizedStatus={normalizedStatus}
                        fallbackLabel={item.status ?? 'Sin estado'}
                        size="sm"
                      />
                    </View>
                    <ThemedText style={styles.timelineDate}>{updatedLabel}</ThemedText>
                    {item.message ? (
                      <ThemedText style={styles.timelineMessage}>
                        Solicitud: {item.message}
                      </ThemedText>
                    ) : null}
                    {item.reason ? (
                      <ThemedText style={styles.timelineMessage}>
                        Respuesta: {item.reason}
                      </ThemedText>
                    ) : null}
                    {item.notes ? (
                      <ThemedText style={styles.timelineMessage}>
                        Observaciones: {item.notes}
                      </ThemedText>
                    ) : null}
                    {responseMessage ? (
                      <View
                        style={[
                          styles.notificationSummaryCard,
                          { borderColor: cardBorder, backgroundColor: summaryBackground },
                        ]}
                      >
                        <ThemedText style={styles.notificationSummaryTitle}>
                          Mensaje enviado al solicitante
                        </ThemedText>
                        {responseTemplateLabel ? (
                          <ThemedText style={styles.notificationSummaryMeta}>
                            Plantilla: {responseTemplateLabel}
                          </ThemedText>
                        ) : null}
                        {responseChannel ? (
                          <ThemedText style={styles.notificationSummaryMeta}>
                            Canal: {responseChannel}
                          </ThemedText>
                        ) : null}
                        {responseSummary ? (
                          <ThemedText style={styles.notificationSummaryMeta}>
                            {responseSummary}
                          </ThemedText>
                        ) : null}
                        <ThemedText style={styles.notificationSummaryBody}>
                          {responseMessage}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.timelineActionsRow}>
                      <TouchableOpacity
                        style={styles.memberLinkButton}
                        onPress={() => router.push(`/company_memberships/${item.id}`)}
                      >
                        <ThemedText style={styles.memberLinkText}>Ver ficha</ThemedText>
                      </TouchableOpacity>
                    </View>
                    {canQuickRespond && composer && selectedTemplate ? (
                      <View style={styles.responseComposer}>
                        <ThemedText style={styles.responseComposerTitle}>
                          Responder solicitud
                        </ThemedText>
                        <ThemedText style={styles.responseComposerHint}>
                          {selectedTemplate.description}
                        </ThemedText>
                        <View style={styles.templateOptionsRow}>
                          {RESPONSE_TEMPLATES.map(template => {
                            const selected = template.id === composer.templateId;
                            const isDestructive = template.decision === 'reject';
                            const resolvedBackground = selected
                              ? isDestructive
                                ? destructiveBackground
                                : actionBackground
                              : 'transparent';
                            const resolvedTextColor = selected
                              ? isDestructive
                                ? destructiveText
                                : actionText
                              : undefined;
                              return (
                                <TouchableOpacity
                                  key={`template-chip-${template.id}`}
                                style={[
                                  styles.templateChipButton,
                                  {
                                    borderColor: selected ? resolvedBackground : cardBorder,
                                    backgroundColor: resolvedBackground,
                                  },
                                ]}
                                onPress={() => handleTemplateChange(item, template.id)}
                              >
                                <ThemedText
                                  style={[
                                    styles.templateChipText,
                                    resolvedTextColor ? { color: resolvedTextColor } : null,
                                    !selected && isDestructive ? { color: destructiveBackground } : null,
                                  ]}
                                >
                                  {template.label}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={styles.composerFieldGroup}>
                          <ThemedText style={styles.composerFieldLabel}>
                            Mensaje para el solicitante
                          </ThemedText>
                          <TextInput
                            multiline
                            value={composer.message}
                            onChangeText={value => handleComposerValueChange(item, 'message', value)}
                            placeholder="Detallá el mensaje que recibirá la persona solicitante"
                            placeholderTextColor={placeholderColor}
                            textAlignVertical="top"
                            style={[
                              styles.composerInput,
                              {
                                backgroundColor: inputBackground,
                                borderColor: messageError ? errorBorder : inputBorder,
                                color: inputText,
                              },
                            ]}
                          />
                          {messageError ? (
                            <ThemedText style={styles.composerErrorText}>
                              Este mensaje es obligatorio.
                            </ThemedText>
                          ) : null}
                        </View>
                        {selectedTemplate.requireReason ? (
                          <View style={styles.composerFieldGroup}>
                            <ThemedText style={styles.composerFieldLabel}>Motivo</ThemedText>
                            <TextInput
                              value={composer.reason}
                              onChangeText={value => handleComposerValueChange(item, 'reason', value)}
                              placeholder="Ej: Documentación incompleta"
                              placeholderTextColor={placeholderColor}
                              style={[
                                styles.composerInput,
                                {
                                  backgroundColor: inputBackground,
                                  borderColor: reasonError ? errorBorder : inputBorder,
                                  color: inputText,
                                },
                              ]}
                            />
                            {reasonError ? (
                              <ThemedText style={styles.composerErrorText}>
                                El motivo es obligatorio para rechazar.
                              </ThemedText>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={styles.composerFieldGroup}>
                          <ThemedText style={styles.composerFieldLabel}>
                            Observaciones internas
                          </ThemedText>
                          <TextInput
                            multiline
                            value={composer.notes}
                            onChangeText={value => handleComposerValueChange(item, 'notes', value)}
                            placeholder="Estas notas quedan registradas en el historial"
                            placeholderTextColor={placeholderColor}
                            textAlignVertical="top"
                            style={[
                              styles.composerInput,
                              {
                                backgroundColor: inputBackground,
                                borderColor: notesError ? errorBorder : inputBorder,
                                color: inputText,
                              },
                            ]}
                          />
                          {notesError ? (
                            <ThemedText style={styles.composerErrorText}>
                              Registrá observaciones para mantener la trazabilidad.
                            </ThemedText>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.composerSubmitButton,
                            {
                              backgroundColor:
                                selectedTemplate.decision === 'reject'
                                  ? destructiveBackground
                                  : actionBackground,
                            },
                          ]}
                          onPress={() => handleSendResponse(item)}
                          disabled={respondingId === item.id}
                          activeOpacity={0.85}
                        >
                          {respondingId === item.id ? (
                            <ActivityIndicator
                              color={
                                selectedTemplate.decision === 'reject' ? destructiveText : actionText
                              }
                            />
                          ) : (
                            <ThemedText
                              style={[
                                styles.composerSubmitText,
                                {
                                  color:
                                    selectedTemplate.decision === 'reject'
                                      ? destructiveText
                                      : actionText,
                                },
                              ]}
                            >
                              {selectedTemplate.ctaLabel}
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.timelineSeparator} />}
              scrollEnabled={false}
            />
          ) : (
            <ThemedText style={styles.membershipNotice}>
              {membershipsLoading
                ? 'Sincronizando historial...'
                : 'No hay movimientos registrados todavía.'}
            </ThemedText>
          )}
        </View>
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
  membershipAnalyticsPanel: {
    gap: 16,
  },
  membershipStatusCard: {
    marginTop: 16,
    gap: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  analyticsColumn: {
    flex: 1,
    gap: 8,
    minWidth: 160,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 14,
    color: '#666',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  kpiHint: {
    fontSize: 13,
    color: '#888',
  },
  memberNavigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberNavigationButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexGrow: 1,
    minWidth: 140,
  },
  memberNavigationLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberNavigationSubLabel: {
    fontSize: 13,
    color: '#666',
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressCardTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  addressGpsBadge: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
  timelineContainer: {
    marginTop: 16,
    gap: 12,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: '#e3e3e3',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineUserBlock: {
    flex: 1,
  },
  timelineName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timelineRole: {
    fontSize: 13,
    color: '#666',
  },
  timelineDate: {
    fontSize: 13,
    color: '#666',
  },
  timelineMessage: {
    fontSize: 14,
    color: '#555',
  },
  timelineActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  memberLinkButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  memberLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationSummaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  notificationSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  notificationSummaryMeta: {
    fontSize: 12,
    color: '#666',
  },
  notificationSummaryBody: {
    fontSize: 14,
  },
  responseComposer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    gap: 12,
  },
  responseComposerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  responseComposerHint: {
    fontSize: 13,
    color: '#666',
  },
  templateOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChipButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  composerFieldGroup: {
    gap: 4,
  },
  composerFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  composerInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 42,
  },
  composerErrorText: {
    fontSize: 12,
    color: '#c62828',
  },
  composerSubmitButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  composerSubmitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timelineSeparator: {
    height: 12,
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
