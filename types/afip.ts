export interface AfipEvent {
  id: string;
  invoice_id?: number | null;
  afip_point_of_sale_id?: number | null;
  afip_voucher_type?: string | null;
  voucher_number?: string | null;
  event_type?: string | null;
  status?: string | null;
  level?: string | null;
  message?: string | null;
  detail?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  payload?: unknown;
  [key: string]: unknown;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseJsonString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

export const normaliseAfipEvent = (input: unknown): AfipEvent | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const idSource = record['id'] ?? record['event_id'] ?? record['uuid'] ?? record['identifier'];
  const id = typeof idSource === 'string' && idSource.trim() ? idSource.trim() : String(idSource ?? '');
  if (!id) {
    return null;
  }

  const messageCandidate = record['message'] ?? record['detail'] ?? record['error'] ?? record['summary'];
  const detailCandidate = record['detail'] ?? record['description'] ?? null;

  const payloadCandidate =
    record['payload'] ?? record['afip_payload'] ?? record['response_payload'] ?? record['afip_response'];

  const normalised: AfipEvent = {
    id,
    invoice_id:
      toNumberOrNull(
        record['invoice_id'] ?? record['invoiceId'] ?? record['afip_invoice_id'] ?? record['invoice']
      ) ?? undefined,
    afip_point_of_sale_id:
      toNumberOrNull(
        record['afip_point_of_sale_id'] ?? record['point_of_sale_id'] ?? record['point_of_sale']
      ) ?? undefined,
    afip_voucher_type:
      typeof record['afip_voucher_type'] === 'string'
        ? record['afip_voucher_type']
        : typeof record['voucher_type'] === 'string'
          ? record['voucher_type']
          : record['voucher']
            ? String(record['voucher'])
            : undefined,
    voucher_number:
      record['voucher_number']
        ? String(record['voucher_number'])
        : record['receipt_number']
          ? String(record['receipt_number'])
          : undefined,
    event_type:
      typeof record['event_type'] === 'string'
        ? record['event_type']
        : typeof record['type'] === 'string'
          ? record['type']
          : undefined,
    status:
      typeof record['status'] === 'string'
        ? record['status']
        : typeof record['result'] === 'string'
          ? record['result']
          : undefined,
    level:
      typeof record['level'] === 'string'
        ? record['level']
        : typeof record['severity'] === 'string'
          ? record['severity']
          : undefined,
    message: messageCandidate ? String(messageCandidate) : undefined,
    detail: detailCandidate ? String(detailCandidate) : undefined,
    created_at:
      typeof record['created_at'] === 'string'
        ? record['created_at']
        : typeof record['timestamp'] === 'string'
          ? record['timestamp']
          : typeof record['createdAt'] === 'string'
            ? record['createdAt']
            : undefined,
    updated_at:
      typeof record['updated_at'] === 'string'
        ? record['updated_at']
        : typeof record['updatedAt'] === 'string'
          ? record['updatedAt']
          : undefined,
    payload: parseJsonString(payloadCandidate),
  };

  return normalised;
};

export const parseAfipEventsCollection = (input: unknown): AfipEvent[] => {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map(normaliseAfipEvent).filter((event): event is AfipEvent => Boolean(event));
  }

  if (typeof input === 'object') {
    const values = Object.values(input as Record<string, unknown>);
    return values.map(normaliseAfipEvent).filter((event): event is AfipEvent => Boolean(event));
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parseAfipEventsCollection(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

export const parseAfipResponsePayload = (input: unknown): unknown => {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return input;
};
