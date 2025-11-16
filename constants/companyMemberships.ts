import { normalizeNullableText } from '@/utils/normalizeNullableText';

export type MembershipLifecycleStatus = 'pending' | 'approved' | 'rejected';

export interface MembershipStatusMetadata {
  value: MembershipLifecycleStatus;
  label: string;
  description: string;
  keywords: string[];
  order: number;
  colors: {
    lightBackground: string;
    darkBackground: string;
    lightText: string;
    darkText: string;
  };
}

const STATUS_METADATA: Record<MembershipLifecycleStatus, MembershipStatusMetadata> = {
  pending: {
    value: 'pending',
    label: 'Pendiente',
    description: 'La solicitud está a la espera de revisión o respuesta.',
    keywords: ['pending', 'pendiente', 'espera', 'solicit', 'waiting', 'review'],
    order: 0,
    colors: {
      lightBackground: '#FFF4E6',
      darkBackground: '#5b3d2a',
      lightText: '#a24d12',
      darkText: '#ffe3c7',
    },
  },
  approved: {
    value: 'approved',
    label: 'Aprobado',
    description: 'El usuario ya cuenta con acceso activo a la empresa.',
    keywords: ['approved', 'aprobado', 'activo', 'active', 'vigente', 'habilitado'],
    order: 1,
    colors: {
      lightBackground: '#E6F4FF',
      darkBackground: '#2d465c',
      lightText: '#0b60a1',
      darkText: '#d4ecff',
    },
  },
  rejected: {
    value: 'rejected',
    label: 'Rechazado',
    description: 'La solicitud fue rechazada o revocada por un administrador.',
    keywords: ['rejected', 'rechaz', 'deneg', 'declin', 'cancel', 'revoc', 'baja'],
    order: 2,
    colors: {
      lightBackground: '#FCE8E6',
      darkBackground: '#5b2c2c',
      lightText: '#b42318',
      darkText: '#ffd2cc',
    },
  },
};

export const MEMBERSHIP_STATUS_OPTIONS = (Object.values(STATUS_METADATA) as MembershipStatusMetadata[]).map(
  ({ value, label, description }) => ({ value, label, description })
);

export const MEMBERSHIP_STATUS_ORDER = ['pending', 'approved', 'rejected'] as const;

export const normalizeMembershipStatus = (
  value?: string | null
): MembershipLifecycleStatus | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeNullableText(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  const directMatch = STATUS_METADATA[normalized as MembershipLifecycleStatus];
  if (directMatch) {
    return directMatch.value;
  }

  const entry = (Object.values(STATUS_METADATA) as MembershipStatusMetadata[]).find(metadata =>
    metadata.keywords.some(keyword => normalized.includes(keyword))
  );

  return entry ? entry.value : null;
};

export const getMembershipStatusMetadata = (
  status: MembershipLifecycleStatus | null | undefined
): MembershipStatusMetadata | null => {
  if (!status) {
    return null;
  }
  return STATUS_METADATA[status] ?? null;
};

export const getMembershipStatusSortWeight = (
  status: MembershipLifecycleStatus | null | undefined
): number => {
  if (!status) {
    return MEMBERSHIP_STATUS_ORDER.length;
  }
  const index = MEMBERSHIP_STATUS_ORDER.indexOf(status);
  return index >= 0 ? index : MEMBERSHIP_STATUS_ORDER.length;
};

export interface MembershipRoleOption {
  value: string;
  label: string;
  description?: string;
}

export const MEMBERSHIP_ROLE_SUGGESTIONS: MembershipRoleOption[] = [
  {
    value: 'Administrador/a',
    label: 'Administrador/a',
    description: 'Acceso completo para gestionar usuarios y datos de la empresa.',
  },
  {
    value: 'Representante legal',
    label: 'Representante legal',
    description: 'Designado para validar contratos y documentación formal.',
  },
  {
    value: 'Responsable comercial',
    label: 'Responsable comercial',
    description: 'Gestiona oportunidades, presupuestos y clientes asociados.',
  },
  {
    value: 'Supervisor/a operativo',
    label: 'Supervisor/a operativo',
    description: 'Coordina tareas diarias y puede aprobar solicitudes tácticas.',
  },
  {
    value: 'Colaborador/a',
    label: 'Colaborador/a',
    description: 'Participa en tareas específicas con visibilidad limitada.',
  },
  {
    value: 'Consulta',
    label: 'Consulta',
    description: 'Solo lectura para auditorías o revisiones puntuales.',
  },
];

export const findMembershipRoleSuggestion = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }
  return (
    MEMBERSHIP_ROLE_SUGGESTIONS.find(option => option.value.toLowerCase() === normalized.toLowerCase()) ??
    null
  );
};
