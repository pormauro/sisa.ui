import React, { createContext, useCallback, useContext, useEffect, ReactNode } from 'react';
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

interface ReportsContextValue {
  reports: ReportRecord[];
  loadReports: (filters?: ReportFilters) => Promise<void>;
  upsertReport: (report: ReportRecord) => void;
  removeReport: (reportId: number) => void;
}

export const ReportsContext = createContext<ReportsContextValue>({
  reports: [],
  loadReports: async () => {},
  upsertReport: () => {},
  removeReport: () => {},
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

  const removeReport = useCallback(
    (reportId: number) => {
      setReports(prev => prev.filter(report => report.id !== reportId));
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
        const itemsPayload = Array.isArray(data?.reports)
          ? data.reports
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.reports?.data)
          ? data.reports.data
          : Array.isArray(data?.data?.data)
          ? data.data.data
          : [];
        const items: any[] = itemsPayload.filter(Boolean);
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

  return (
    <ReportsContext.Provider value={{ reports, loadReports, upsertReport, removeReport }}>
      {children}
    </ReportsContext.Provider>
  );
};

