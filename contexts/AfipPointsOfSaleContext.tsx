// /contexts/AfipPointsOfSaleContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export interface AfipPointOfSale {
  id: number;
  point_number: number;
  receipt_type: string;
  address: string;
  description?: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

type CreateOrUpdatePayload = {
  id?: number;
  point_number: number;
  receipt_type: string;
  address: string;
  description?: string | null;
  active?: boolean;
};

interface AfipPointsOfSaleContextValue {
  points: AfipPointOfSale[];
  listPoints: () => Promise<void>;
  createPoint: (payload: CreateOrUpdatePayload) => Promise<AfipPointOfSale | null>;
  togglePoint: (id: number, nextActive?: boolean) => Promise<AfipPointOfSale | null>;
}

const noopAsync = async () => {};

export const AfipPointsOfSaleContext = createContext<AfipPointsOfSaleContextValue>({
  points: [],
  listPoints: noopAsync,
  createPoint: async () => null,
  togglePoint: async () => null,
});

const resolveIdentifier = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalisePoint = (input: unknown): AfipPointOfSale | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const id =
    resolveIdentifier(record['id']) ??
    resolveIdentifier(record['point_of_sale_id']) ??
    resolveIdentifier(record['pointId']);

  const numberValue =
    resolveIdentifier(record['point_number']) ?? resolveIdentifier(record['number']) ?? resolveIdentifier(record['pos']);

  if (id === null || numberValue === null) {
    return null;
  }

  const receiptRaw = record['receipt_type'] ?? record['receiptType'] ?? record['voucher_type'];
  const addressRaw = record['address'] ?? record['domicile'] ?? record['location'];
  const description =
    typeof record['description'] === 'string'
      ? record['description']
      : typeof record['name'] === 'string'
        ? record['name']
        : null;

  const activeRaw = record['active'] ?? record['enabled'] ?? record['is_active'];
  const active = typeof activeRaw === 'boolean' ? activeRaw : `${activeRaw}`.toLowerCase() !== 'false';

  const normalised: AfipPointOfSale = {
    id,
    point_number: numberValue,
    receipt_type: typeof receiptRaw === 'string' ? receiptRaw : '',
    address: typeof addressRaw === 'string' ? addressRaw : '',
    description,
    active,
    created_at: typeof record['created_at'] === 'string' ? record['created_at'] : undefined,
    updated_at: typeof record['updated_at'] === 'string' ? record['updated_at'] : undefined,
  };

  return normalised;
};

export const AfipPointsOfSaleProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [points, setPoints] = useCachedState<AfipPointOfSale[]>('afipPointsOfSale', []);
  const pointsRef = useRef(points);

  const canList = permissions.includes('listAfipPointsOfSale');
  const canCreateOrUpdate =
    permissions.includes('createAfipPointOfSale') || permissions.includes('updateAfipPointOfSale');
  const canToggle = permissions.includes('toggleAfipPointOfSale');

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    setPoints(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setPoints]);

  useEffect(() => {
    if (!canList) {
      setPoints(prev => (prev.length > 0 ? [] : prev));
    }
  }, [canList, setPoints]);

  const buildHeaders = useCallback((): Record<string, string> => {
    if (!token) {
      throw new Error('Token no disponible para puntos de venta AFIP');
    }

    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const parseCollection = useCallback((payload: unknown): AfipPointOfSale[] => {
    if (!payload) {
      return [];
    }

    const resolveArray = (value: unknown): unknown[] => {
      if (!value) {
        return [];
      }
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const candidates = ['points', 'points_of_sale', 'data', 'items', 'results'];
        for (const key of candidates) {
          const maybeArray = record[key];
          if (Array.isArray(maybeArray)) {
            return maybeArray;
          }
        }
      }
      return [];
    };

    return resolveArray(payload)
      .map(normalisePoint)
      .filter((point): point is AfipPointOfSale => Boolean(point))
      .sort((a, b) => a.point_number - b.point_number);
  }, []);

  const listPoints = useCallback(async () => {
    if (!canList) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/afip/points_of_sale`, {
        method: 'GET',
        headers: buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json().catch(() => []);
      const collection = parseCollection(payload);
      if (collection.length > 0) {
        setPoints(sortByNewest(collection, getDefaultSortValue));
      } else {
        setPoints(collection);
      }
    } catch (error) {
      console.error('Error al cargar puntos de venta AFIP:', error);
      Alert.alert('Error', 'No se pudieron sincronizar los puntos de venta de AFIP.');
    }
  }, [buildHeaders, canList, parseCollection, setPoints]);

  const mergePoint = useCallback(
    (next: AfipPointOfSale) => {
      setPoints(prev => {
        const existingIndex = prev.findIndex(point => point.id === next.id);
        if (existingIndex === -1) {
          return ensureSortedByNewest([...prev, next], getDefaultSortValue);
        }
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...next };
        return ensureSortedByNewest(updated, getDefaultSortValue);
      });
    },
    [setPoints]
  );

  const createPoint = useCallback(
    async (payload: CreateOrUpdatePayload): Promise<AfipPointOfSale | null> => {
      if (!token) {
        Alert.alert('Sesión no disponible', 'Inicia sesión para gestionar puntos de venta.');
        return null;
      }
      if (!canCreateOrUpdate) {
        Alert.alert('Permiso insuficiente', 'No tienes permiso para crear o editar puntos de venta AFIP.');
        return null;
      }

      const { id, ...body } = payload;
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${BASE_URL}/afip/points_of_sale/${id}` : `${BASE_URL}/afip/points_of_sale`;

      try {
        const response = await fetch(url, {
          method,
          headers: buildHeaders(),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const payloadData = await response.json().catch(() => null);
        const parsed =
          normalisePoint(
            payloadData && typeof payloadData === 'object' ? (payloadData as Record<string, unknown>)['point_of_sale'] ?? payloadData : null
          ) ??
          (id
            ? {
                id,
                point_number: payload.point_number,
                receipt_type: payload.receipt_type,
                address: payload.address,
                description: payload.description,
                active: payload.active ?? pointsRef.current.find(item => item.id === id)?.active ?? true,
              }
            : null);

        if (parsed) {
          mergePoint(parsed);
          return parsed;
        }
      } catch (error) {
        console.error('Error al crear/actualizar punto de venta AFIP:', error);
        Alert.alert('Error', 'No se pudo guardar el punto de venta. Revisa los datos e intenta nuevamente.');
      }
      return null;
    },
    [buildHeaders, canCreateOrUpdate, mergePoint, token]
  );

  const togglePoint = useCallback(
    async (id: number, nextActive?: boolean): Promise<AfipPointOfSale | null> => {
      if (!token) {
        Alert.alert('Sesión no disponible', 'Inicia sesión para gestionar puntos de venta.');
        return null;
      }
      if (!canToggle) {
        Alert.alert('Permiso insuficiente', 'No tienes permiso para habilitar o deshabilitar puntos de venta AFIP.');
        return null;
      }

      const current = pointsRef.current.find(point => point.id === id);
      const desiredState = typeof nextActive === 'boolean' ? nextActive : !current?.active;

      try {
        const response = await fetch(`${BASE_URL}/afip/points_of_sale/${id}/toggle`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({ active: desiredState }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const payload = await response.json().catch(() => null);
        const parsed =
          normalisePoint(
            payload && typeof payload === 'object' ? (payload as Record<string, unknown>)['point_of_sale'] ?? payload : null
          ) ??
          (current
            ? {
                ...current,
                active: desiredState,
              }
            : null);

        if (parsed) {
          mergePoint(parsed);
          return parsed;
        }
      } catch (error) {
        console.error('Error al alternar punto de venta AFIP:', error);
        Alert.alert('Error', 'No se pudo cambiar el estado del punto de venta.');
      }
      return null;
    },
    [buildHeaders, canToggle, mergePoint, token]
  );

  const contextValue = useMemo(
    () => ({
      points,
      listPoints,
      createPoint,
      togglePoint,
    }),
    [createPoint, listPoints, points, togglePoint]
  );

  return <AfipPointsOfSaleContext.Provider value={contextValue}>{children}</AfipPointsOfSaleContext.Provider>;
};

