import { normalizeNullableText } from '@/utils/normalizeNullableText';

export type MembershipLifecycleStatus =
  | 'pending'
  | 'invited'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'left'
  | 'removed'
  | 'suspended';

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
  invited: {
    value: 'invited',
    label: 'Invitado/a',
    description: 'Se envió una invitación y falta que la persona la acepte.',
    keywords: ['invited', 'invitado', 'invita', 'invite', 'invitación'],
    order: 1,
    colors: {
      lightBackground: '#F2EBFF',
      darkBackground: '#3b2f52',
      lightText: '#5b3db8',
      darkText: '#e8ddff',
    },
  },
  approved: {
    value: 'approved',
    label: 'Aprobado',
    description: 'El usuario ya cuenta con acceso activo a la empresa.',
    keywords: ['approved', 'aprobado', 'activo', 'active', 'vigente', 'habilitado'],
    order: 2,
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
    order: 5,
    colors: {
      lightBackground: '#FCE8E6',
      darkBackground: '#5b2c2c',
      lightText: '#b42318',
      darkText: '#ffd2cc',
    },
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelado',
    description: 'La solicitud se canceló antes de ser aprobada.',
    keywords: ['cancel', 'cancelled', 'cancelado', 'cancelada', 'canceled'],
    order: 4,
    colors: {
      lightBackground: '#FFF3E0',
      darkBackground: '#4a3521',
      lightText: '#a05805',
      darkText: '#ffd6ad',
    },
  },
  left: {
    value: 'left',
    label: 'Abandonó',
    description: 'La persona decidió dejar la empresa y se revocó su acceso.',
    keywords: ['left', 'abandono', 'abandonó', 'renunc', 'leave'],
    order: 6,
    colors: {
      lightBackground: '#F4F4F5',
      darkBackground: '#3b3b3f',
      lightText: '#52525b',
      darkText: '#f4f4f5',
    },
  },
  removed: {
    value: 'removed',
    label: 'Removido',
    description: 'Un administrador quitó el acceso manualmente.',
    keywords: ['removed', 'removido', 'quitado', 'expulsado', 'expulsión'],
    order: 7,
    colors: {
      lightBackground: '#FFE8F1',
      darkBackground: '#4f2c3b',
      lightText: '#b41269',
      darkText: '#ffd6ec',
    },
  },
  suspended: {
    value: 'suspended',
    label: 'Suspendido',
    description: 'El acceso fue pausado temporalmente hasta nuevo aviso.',
    keywords: ['suspend', 'suspended', 'suspendido', 'bloqueado', 'pausado'],
    order: 3,
    colors: {
      lightBackground: '#FFF1F0',
      darkBackground: '#4f2b29',
      lightText: '#cf4a33',
      darkText: '#ffd9d2',
    },
  },
};

export const MEMBERSHIP_STATUS_OPTIONS = (Object.values(
  STATUS_METADATA
) as MembershipStatusMetadata[])
  .sort((a, b) => a.order - b.order)
  .map(({ value, label, description }) => ({ value, label, description }));

export const MEMBERSHIP_STATUS_ORDER = [
  'pending',
  'invited',
  'approved',
  'suspended',
  'cancelled',
  'rejected',
  'left',
  'removed',
] as const;

const pendingStatusSet = new Set<MembershipLifecycleStatus>(['pending', 'invited']);
const approvedStatusSet = new Set<MembershipLifecycleStatus>(['approved']);
const rejectedStatusSet = new Set<MembershipLifecycleStatus>(['rejected', 'cancelled', 'left', 'removed']);
const suspendedStatusSet = new Set<MembershipLifecycleStatus>(['suspended']);

export const isPendingMembershipStatus = (
  status: MembershipLifecycleStatus | null | undefined
): boolean => {
  if (!status) {
    return false;
  }
  return pendingStatusSet.has(status);
};

export const isApprovedMembershipStatus = (
  status: MembershipLifecycleStatus | null | undefined
): boolean => {
  if (!status) {
    return false;
  }
  return approvedStatusSet.has(status);
};

export const isRejectedMembershipStatus = (
  status: MembershipLifecycleStatus | null | undefined
): boolean => {
  if (!status) {
    return false;
  }
  return rejectedStatusSet.has(status);
};

export const isSuspendedMembershipStatus = (
  status: MembershipLifecycleStatus | null | undefined
): boolean => {
  if (!status) {
    return false;
  }
  return suspendedStatusSet.has(status);
};

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
