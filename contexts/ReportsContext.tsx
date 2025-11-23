import React, { createContext, useCallback, useContext, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export type ReportStatus = 'draft' | 'generated' | 'archived';

export interface ReportRecord {
  id: number;
  file_id: number;
  title: string;
  report_type: string;
  description?: string | null;
  status?: ReportStatus | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  download_url?: string | null;
}

export interface ReportFilters {
  report_type?: string;
  status?: string;
  file_id?: number;
  search?: string;
}

export interface ReportPayload {
  file_id: number;
  title: string;
  report_type: string;
  description?: string | null;
  status?: ReportStatus;
  metadata?: Record<string, unknown> | null;
  download_url?: string | null;
}

interface ReportsContextValue {
  reports: ReportRecord[];
  loadReports: (filters?: ReportFilters) => Promise<void>;
  addReport: (payload: ReportPayload) => Promise<ReportRecord | null>;
  upsertReport: (report: ReportRecord) => void;
}

export const ReportsContext = createContext<ReportsContextValue>({
  reports: [],
  loadReports: async () => {},
  addReport: async () => null,
  upsertReport: () => {},
});

const normalizeMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return { raw: metadata };
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveReportId = (data: any): number | null => {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.id === 'number') return data.id;
  if (typeof data.report_id === 'number') return data.report_id;
  if (typeof data.reportId === 'number') return data.reportId;
  if (typeof data.report?.id === 'number') return data.report.id;
  const numericId = toNullableNumber(data.id ?? data.report_id ?? data.reportId);
  return numericId;
};

const normalizeReport = (record: any): ReportRecord | null => {
  const id = toNullableNumber(record?.id) ?? toNullableNumber(record?.report_id);
  const fileId = toNullableNumber(record?.file_id);
  if (id === null || fileId === null) {
    return null;
  }

  return {
    id,
    file_id: fileId,
    title: typeof record?.title === 'string' ? record.title : 'Reporte',
    report_type:
      typeof record?.report_type === 'string' ? record.report_type : record?.type ?? 'general',
    description: typeof record?.description === 'string' ? record.description : null,
    status: typeof record?.status === 'string' ? (record.status as ReportStatus) : null,
    metadata: normalizeMetadata(record?.metadata),
    created_at: typeof record?.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record?.updated_at === 'string' ? record.updated_at : null,
    download_url: typeof record?.download_url === 'string' ? record.download_url : null,
  };
};

const buildQueryString = (filters?: ReportFilters): string => {
  if (!filters) return '';
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const ReportsProvider = ({ children }: { children: ReactNode }) => {
  const [reports, setReports] = useCachedState<ReportRecord[]>('reports', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setReports(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setReports]);

  const upsertReport = useCallback(
    (report: ReportRecord) => {
      setReports(prev =>
        ensureSortedByNewest(
          [...prev.filter(item => item.id !== report.id), report],
          getDefaultSortValue,
        ),
      );
    },
    [setReports],
  );

  const loadReports = useCallback(
    async (filters?: ReportFilters) => {
      try {
        const response = await fetch(`${BASE_URL}/reports${buildQueryString(filters)}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const items: any[] = Array.isArray(data?.reports)
          ? data.reports
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const normalized = items
          .map(normalizeReport)
          .filter((item): item is ReportRecord => Boolean(item));
        setReports(sortByNewest(normalized, getDefaultSortValue));
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar reportes, se solicitará uno nuevo.');
          return;
        }
        console.error('Error loading reports:', error);
      }
    },
    [setReports, token],
  );

  const addReport = useCallback(
    async (payload: ReportPayload): Promise<ReportRecord | null> => {
      try {
        const response = await fetch(`${BASE_URL}/reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errorMessage =
            typeof data?.message === 'string'
              ? data.message
              : 'No se pudo registrar el reporte generado.';
          Alert.alert('Error', errorMessage);
          return null;
        }
        const id = resolveReportId(data);
        if (id === null) {
          Alert.alert(
            'Reporte registrado sin ID',
            'El servidor confirmó la creación pero no envió un identificador explícito.',
          );
        }
        const newReport: ReportRecord = {
          id: id ?? Date.now(),
          ...payload,
          status: payload.status ?? 'generated',
          metadata: normalizeMetadata(payload.metadata),
          created_at: typeof data?.created_at === 'string' ? data.created_at : null,
          updated_at: typeof data?.updated_at === 'string' ? data.updated_at : null,
        };
        upsertReport(newReport);
        return newReport;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear un reporte, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error creating report:', error);
        Alert.alert('Error', 'No se pudo registrar el reporte generado.');
        return null;
      }
    },
    [token, upsertReport],
  );

  return (
    <ReportsContext.Provider value={{ reports, loadReports, addReport, upsertReport }}>
      {children}
    </ReportsContext.Provider>
  );
};

