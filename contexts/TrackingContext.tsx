import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';
import {
  enqueueTrackingPoint as enqueueTrackingPointInDb,
  getCachedTrackingPolicy,
  getNextTrackingSequence,
  getTrackingQueueSummary,
  getTrackingSyncState,
  listQueuedTrackingPoints,
  listRetryableTrackingPoints,
  markTrackingPointsAcked,
  markTrackingPointsBackToFailed,
  markTrackingPointsFailed,
  markTrackingPointsSending,
  saveTrackingPolicy,
  saveTrackingSyncState,
} from '@/database/tracking';
import type {
  NearbyClient,
  TrackingNearbyResponse,
  TrackingPointDraft,
  TrackingPolicy,
  TrackingQueuePoint,
  TrackingQueueSummary,
  TrackingStatus,
  TrackingSyncResult,
} from '@/src/tracking/types';

interface TrackingContextValue {
  deviceId: string | null;
  policy: TrackingPolicy | null;
  status: TrackingStatus | null;
  lastPolicyRefreshAt: string | null;
  lastStatusRefreshAt: string | null;
  nearbyClients: NearbyClient[];
  recentPoints: TrackingQueuePoint[];
  queueSummary: TrackingQueueSummary;
  canUseTracking: boolean;
  canViewNearbyClients: boolean;
  isLoadingPolicy: boolean;
  isLoadingStatus: boolean;
  isLoadingNearbyClients: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
  refreshPolicy: () => Promise<TrackingPolicy | null>;
  refreshStatus: () => Promise<TrackingStatus | null>;
  loadNearbyClients: (options?: { limit?: number; maxDistanceM?: number }) => Promise<NearbyClient[]>;
  refreshQueueState: () => Promise<void>;
  enqueueTrackingPoint: (point: TrackingPointDraft) => Promise<number>;
  syncPendingPoints: () => Promise<TrackingSyncResult>;
}

const emptyQueueSummary: TrackingQueueSummary = {
  pending: 0,
  sending: 0,
  acked: 0,
  failed: 0,
  total: 0,
  nextSequenceNo: 1,
};

const defaultValue: TrackingContextValue = {
  deviceId: null,
  policy: null,
  status: null,
  lastPolicyRefreshAt: null,
  lastStatusRefreshAt: null,
  nearbyClients: [],
  recentPoints: [],
  queueSummary: emptyQueueSummary,
  canUseTracking: false,
  canViewNearbyClients: false,
  isLoadingPolicy: false,
  isLoadingStatus: false,
  isLoadingNearbyClients: false,
  isSyncing: false,
  lastSyncError: null,
  refreshPolicy: async () => null,
  refreshStatus: async () => null,
  loadNearbyClients: async () => [],
  refreshQueueState: async () => {},
  enqueueTrackingPoint: async () => 0,
  syncPendingPoints: async () => ({ accepted: 0, rejected: 0, attempted: 0, lastServerPointId: null }),
};

export const TrackingContext = createContext<TrackingContextValue>(defaultValue);

const createDeviceId = () =>
  `tracking-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const normalizePolicy = (rawPolicy: any, deviceId: string): TrackingPolicy => ({
  id: typeof rawPolicy?.id === 'number' ? rawPolicy.id : null,
  version: typeof rawPolicy?.version === 'number' ? rawPolicy.version : null,
  name: typeof rawPolicy?.name === 'string' ? rawPolicy.name : null,
  tracking_enabled: Boolean(rawPolicy?.tracking_enabled),
  tracking_profile:
    typeof rawPolicy?.tracking_profile === 'string' ? rawPolicy.tracking_profile : 'disabled',
  sample_min_seconds:
    typeof rawPolicy?.sample_min_seconds === 'number' ? rawPolicy.sample_min_seconds : null,
  sample_max_seconds:
    typeof rawPolicy?.sample_max_seconds === 'number' ? rawPolicy.sample_max_seconds : null,
  distance_filter_m:
    typeof rawPolicy?.distance_filter_m === 'number' ? rawPolicy.distance_filter_m : null,
  high_accuracy:
    typeof rawPolicy?.high_accuracy === 'boolean'
      ? rawPolicy.high_accuracy
      : rawPolicy?.high_accuracy === null || rawPolicy?.high_accuracy === undefined
        ? null
        : Boolean(rawPolicy.high_accuracy),
  visit_radius_m: typeof rawPolicy?.visit_radius_m === 'number' ? rawPolicy.visit_radius_m : null,
  max_batch_size: typeof rawPolicy?.max_batch_size === 'number' ? rawPolicy.max_batch_size : null,
  next_poll_after_seconds:
    typeof rawPolicy?.next_poll_after_seconds === 'number'
      ? rawPolicy.next_poll_after_seconds
      : null,
  assignment_id: typeof rawPolicy?.assignment_id === 'number' ? rawPolicy.assignment_id : null,
  device_id: typeof rawPolicy?.device_id === 'string' ? rawPolicy.device_id : deviceId,
});

export const TrackingProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [deviceId, setDeviceId, deviceIdHydrated] = useCachedState<string | null>('tracking-device-id', null);
  const [policy, setPolicy] = useState<TrackingPolicy | null>(null);
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [lastPolicyRefreshAt, setLastPolicyRefreshAt] = useState<string | null>(null);
  const [lastStatusRefreshAt, setLastStatusRefreshAt] = useState<string | null>(null);
  const [nearbyClients, setNearbyClients] = useState<NearbyClient[]>([]);
  const [recentPoints, setRecentPoints] = useState<TrackingQueuePoint[]>([]);
  const [queueSummary, setQueueSummary] = useState<TrackingQueueSummary>(emptyQueueSummary);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingNearbyClients, setIsLoadingNearbyClients] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const canUseTracking = useMemo(
    () =>
      ['getTrackingPolicy', 'uploadTrackingPoints', 'getTrackingStatus'].every(permission =>
        permissions.includes(permission),
      ),
    [permissions],
  );

  const canViewNearbyClients = useMemo(
    () => permissions.includes('listNearbyClients'),
    [permissions],
  );

  useEffect(() => {
    if (!deviceIdHydrated || deviceId) {
      return;
    }

    setDeviceId(createDeviceId());
  }, [deviceId, deviceIdHydrated, setDeviceId]);

  const refreshQueueState = useCallback(async () => {
    if (!deviceId) {
      setQueueSummary(emptyQueueSummary);
      setRecentPoints([]);
      return;
    }

    const [summary, points] = await Promise.all([
      getTrackingQueueSummary(deviceId),
      listQueuedTrackingPoints(deviceId, 12),
    ]);

    setQueueSummary(summary);
    setRecentPoints(points);
  }, [deviceId]);

  const refreshPolicy = useCallback(async (): Promise<TrackingPolicy | null> => {
    if (!deviceId) {
      return null;
    }

    if (!token || !permissions.includes('getTrackingPolicy')) {
      const cachedPolicy = await getCachedTrackingPolicy(deviceId);
      setPolicy(cachedPolicy);
      setLastPolicyRefreshAt(new Date().toISOString());
      return cachedPolicy;
    }

    setIsLoadingPolicy(true);
    try {
      const response = await fetch(
        `${BASE_URL}/tracking/policy?device_id=${encodeURIComponent(deviceId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al obtener la policy de tracking.`);
      }

      const data = await response.json();
      const nextPolicy = normalizePolicy(data?.policy, deviceId);
      await saveTrackingPolicy(deviceId, nextPolicy);
      setPolicy(nextPolicy);
      setLastPolicyRefreshAt(new Date().toISOString());
      return nextPolicy;
    } catch (error) {
      console.error('Error loading tracking policy', error);
      const cachedPolicy = await getCachedTrackingPolicy(deviceId);
      setPolicy(cachedPolicy);
      setLastPolicyRefreshAt(new Date().toISOString());
      return cachedPolicy;
    } finally {
      setIsLoadingPolicy(false);
    }
  }, [deviceId, permissions, token]);

  const refreshStatus = useCallback(async (): Promise<TrackingStatus | null> => {
    if (!deviceId || !token || !permissions.includes('getTrackingStatus')) {
      return null;
    }

    setIsLoadingStatus(true);
    try {
      const response = await fetch(
        `${BASE_URL}/tracking/status?device_id=${encodeURIComponent(deviceId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al consultar el estado de tracking.`);
      }

      const data = (await response.json()) as TrackingStatus;
      setStatus(data);
      setLastStatusRefreshAt(new Date().toISOString());
      return data;
    } catch (error) {
      console.error('Error loading tracking status', error);
      return null;
    } finally {
      setIsLoadingStatus(false);
    }
  }, [deviceId, permissions, token]);

  const loadNearbyClients = useCallback(
    async (options?: { limit?: number; maxDistanceM?: number }) => {
      if (!deviceId || !token || !canViewNearbyClients) {
        setNearbyClients([]);
        return [];
      }

      setIsLoadingNearbyClients(true);
      try {
        const params = new URLSearchParams();
        params.set('device_id', deviceId);
        if (options?.limit) {
          params.set('limit', String(options.limit));
        }
        if (options?.maxDistanceM) {
          params.set('max_distance_m', String(options.maxDistanceM));
        }

        const response = await fetch(`${BASE_URL}/tracking/nearby-clients?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} al consultar clientes cercanos.`);
        }

        const data = (await response.json()) as TrackingNearbyResponse;
        const clients = Array.isArray(data?.clients) ? data.clients : [];
        setNearbyClients(clients);
        return clients;
      } catch (error) {
        console.error('Error loading nearby clients', error);
        setNearbyClients([]);
        return [];
      } finally {
        setIsLoadingNearbyClients(false);
      }
    },
    [canViewNearbyClients, deviceId, token],
  );

  const enqueueTrackingPoint = useCallback(
    async (point: TrackingPointDraft): Promise<number> => {
      if (!deviceId) {
        throw new Error('Todavia no hay un device id disponible para tracking.');
      }

      const sequenceNo = await getNextTrackingSequence(deviceId);
      await enqueueTrackingPointInDb(deviceId, sequenceNo, point);
      await refreshQueueState();
      return sequenceNo;
    },
    [deviceId, refreshQueueState],
  );

  const syncPendingPoints = useCallback(async (): Promise<TrackingSyncResult> => {
    if (!deviceId || !token || !permissions.includes('uploadTrackingPoints')) {
      return { accepted: 0, rejected: 0, attempted: 0, lastServerPointId: null };
    }

    setIsSyncing(true);
    setLastSyncError(null);
    let localIds: number[] = [];

    try {
      const currentPolicy = policy ?? (await getCachedTrackingPolicy(deviceId));
      const batchSize = Math.max(1, currentPolicy?.max_batch_size ?? 100);
      const queuedPoints = await listRetryableTrackingPoints(deviceId, batchSize);

      if (!queuedPoints.length) {
        await refreshQueueState();
        return { accepted: 0, rejected: 0, attempted: 0, lastServerPointId: null };
      }

      const syncState = await getTrackingSyncState(deviceId);
      localIds = queuedPoints.map(point => point.local_id);
      await markTrackingPointsSending(localIds);

      const payload = {
        device_id: deviceId,
        last_known_server_point_id: syncState?.last_server_point_id ?? null,
        points: queuedPoints.map(point => ({
          sequence_no: point.sequence_no,
          captured_at: point.captured_at,
          lat: point.lat,
          lng: point.lng,
          accuracy_m: point.accuracy_m,
          speed_mps: point.speed_mps,
          heading_deg: point.heading_deg,
          altitude_m: point.altitude_m,
          battery_level: point.battery_level,
          is_mock: point.is_mock,
          source: point.source,
          state: point.state,
          job_id: point.job_id,
          client_candidate_id: point.client_candidate_id,
        })),
      };

      const response = await fetch(`${BASE_URL}/tracking/points/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al sincronizar puntos de tracking.`);
      }

      const data = await response.json();
      const accepted = Array.isArray(data?.accepted) ? data.accepted : [];
      const rejected = Array.isArray(data?.rejected) ? data.rejected : [];
      const lastServerPointId =
        typeof data?.last_server_point_id === 'number' ? data.last_server_point_id : null;
      const serverPolicy = data?.policy ? normalizePolicy(data.policy, deviceId) : null;
      const maxAcceptedSequence = accepted.reduce(
        (max: number | null, item: any) =>
          typeof item?.sequence_no === 'number' && (max === null || item.sequence_no > max)
            ? item.sequence_no
            : max,
        null,
      );

      await markTrackingPointsAcked(
        deviceId,
        accepted.map((item: any) => ({
          sequence_no: Number(item.sequence_no),
          server_point_id:
            typeof item?.server_point_id === 'number' ? item.server_point_id : null,
        })),
      );
      await markTrackingPointsFailed(
        deviceId,
        rejected.map((item: any) => ({
          sequence_no: Number(item.sequence_no),
          error:
            typeof item?.error === 'string'
              ? item.error
              : typeof item?.message === 'string'
                ? item.message
                : 'Punto rechazado por el backend.',
        })),
      );

      await saveTrackingSyncState(deviceId, {
        last_server_point_id: lastServerPointId,
        last_uploaded_sequence_no: maxAcceptedSequence,
        last_sync_at: new Date().toISOString(),
        last_policy_version: serverPolicy?.version ?? currentPolicy?.version ?? null,
      });

      if (serverPolicy) {
        await saveTrackingPolicy(deviceId, serverPolicy);
        setPolicy(serverPolicy);
      }

      await Promise.all([refreshQueueState(), refreshStatus()]);

      return {
        accepted: accepted.length,
        rejected: rejected.length,
        attempted: queuedPoints.length,
        lastServerPointId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron sincronizar los puntos.';
      setLastSyncError(message);
      console.error('Error syncing tracking points', error);

      if (localIds.length) {
        await markTrackingPointsBackToFailed(localIds, message);
      }

      await refreshQueueState();
      return { accepted: 0, rejected: 0, attempted: 0, lastServerPointId: null };
    } finally {
      setIsSyncing(false);
    }
  }, [
    deviceId,
    permissions,
    policy,
    refreshQueueState,
    refreshStatus,
    token,
  ]);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    void refreshQueueState();
    void getCachedTrackingPolicy(deviceId)
      .then(cachedPolicy => {
        setPolicy(cachedPolicy);
        setLastPolicyRefreshAt(new Date().toISOString());
      })
      .catch(error => {
        console.error('Error hydrating cached tracking policy', error);
      });
  }, [deviceId, refreshQueueState]);

  useEffect(() => {
    if (!deviceId || !token || !canUseTracking) {
      return;
    }

    void refreshPolicy();
    void refreshStatus();
  }, [canUseTracking, deviceId, refreshPolicy, refreshStatus, token]);

  useEffect(() => {
    if (!deviceId || !token || !canUseTracking) {
      return;
    }

    const delayMs = Math.max(60, policy?.next_poll_after_seconds ?? 300) * 1000;
    const interval = setInterval(() => {
      void refreshPolicy();
    }, delayMs);

    return () => clearInterval(interval);
  }, [canUseTracking, deviceId, policy?.next_poll_after_seconds, refreshPolicy, token]);

  const value = useMemo(
    () => ({
      deviceId,
      policy,
      status,
      lastPolicyRefreshAt,
      lastStatusRefreshAt,
      nearbyClients,
      recentPoints,
      queueSummary,
      canUseTracking,
      canViewNearbyClients,
      isLoadingPolicy,
      isLoadingStatus,
      isLoadingNearbyClients,
      isSyncing,
      lastSyncError,
      refreshPolicy,
      refreshStatus,
      loadNearbyClients,
      refreshQueueState,
      enqueueTrackingPoint,
      syncPendingPoints,
    }),
    [
      canUseTracking,
      canViewNearbyClients,
      deviceId,
      enqueueTrackingPoint,
      isLoadingNearbyClients,
      isLoadingPolicy,
      isLoadingStatus,
      isSyncing,
      lastSyncError,
      loadNearbyClients,
      lastPolicyRefreshAt,
      lastStatusRefreshAt,
      nearbyClients,
      policy,
      queueSummary,
      recentPoints,
      refreshPolicy,
      refreshQueueState,
      refreshStatus,
      status,
      syncPendingPoints,
    ],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
};
