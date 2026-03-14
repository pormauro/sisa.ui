import { getDatabase } from '@/database/Database';
import type {
  TrackingPointDraft,
  TrackingPolicy,
  TrackingQueuePoint,
  TrackingQueueSummary,
} from '@/src/tracking/types';

type CountRow = {
  sync_status: TrackingQueuePoint['sync_status'];
  total: number;
};

type QueueRow = {
  local_id: number;
  device_id: string;
  sequence_no: number;
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  battery_level: number | null;
  is_mock: number;
  source: string | null;
  state: string | null;
  job_id: number | null;
  client_candidate_id: number | null;
  sync_status: TrackingQueuePoint['sync_status'];
  server_point_id: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const nowIso = () => new Date().toISOString();

const toBooleanInt = (value: boolean | null | undefined) => (value ? 1 : 0);

const mapQueueRow = (row: QueueRow): TrackingQueuePoint => ({
  ...row,
  is_mock: Boolean(row.is_mock),
});

export const getCachedTrackingPolicy = async (deviceId: string): Promise<TrackingPolicy | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT
      policy_id,
      version,
      name,
      tracking_enabled,
      tracking_profile,
      sample_min_seconds,
      sample_max_seconds,
      distance_filter_m,
      high_accuracy,
      visit_radius_m,
      max_batch_size,
      next_poll_after_seconds,
      assignment_id,
      device_id
    FROM tracking_policy_cache
    WHERE device_id = ?`,
    [deviceId],
  );

  if (!row) {
    return null;
  }

  return {
    id: row.policy_id,
    version: row.version,
    name: row.name,
    tracking_enabled: Boolean(row.tracking_enabled),
    tracking_profile: row.tracking_profile,
    sample_min_seconds: row.sample_min_seconds,
    sample_max_seconds: row.sample_max_seconds,
    distance_filter_m: row.distance_filter_m,
    high_accuracy: row.high_accuracy === null || row.high_accuracy === undefined ? null : Boolean(row.high_accuracy),
    visit_radius_m: row.visit_radius_m,
    max_batch_size: row.max_batch_size,
    next_poll_after_seconds: row.next_poll_after_seconds,
    assignment_id: row.assignment_id,
    device_id: row.device_id,
  };
};

export const saveTrackingPolicy = async (deviceId: string, policy: TrackingPolicy): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO tracking_policy_cache (
      device_id,
      policy_id,
      version,
      name,
      tracking_enabled,
      tracking_profile,
      sample_min_seconds,
      sample_max_seconds,
      distance_filter_m,
      high_accuracy,
      visit_radius_m,
      max_batch_size,
      next_poll_after_seconds,
      assignment_id,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      policy_id = excluded.policy_id,
      version = excluded.version,
      name = excluded.name,
      tracking_enabled = excluded.tracking_enabled,
      tracking_profile = excluded.tracking_profile,
      sample_min_seconds = excluded.sample_min_seconds,
      sample_max_seconds = excluded.sample_max_seconds,
      distance_filter_m = excluded.distance_filter_m,
      high_accuracy = excluded.high_accuracy,
      visit_radius_m = excluded.visit_radius_m,
      max_batch_size = excluded.max_batch_size,
      next_poll_after_seconds = excluded.next_poll_after_seconds,
      assignment_id = excluded.assignment_id,
      updated_at = excluded.updated_at`,
    [
      deviceId,
      policy.id ?? null,
      policy.version ?? null,
      policy.name ?? null,
      toBooleanInt(policy.tracking_enabled),
      policy.tracking_profile ?? 'disabled',
      policy.sample_min_seconds ?? null,
      policy.sample_max_seconds ?? null,
      policy.distance_filter_m ?? null,
      policy.high_accuracy === null || policy.high_accuracy === undefined ? null : toBooleanInt(policy.high_accuracy),
      policy.visit_radius_m ?? null,
      policy.max_batch_size ?? null,
      policy.next_poll_after_seconds ?? null,
      policy.assignment_id ?? null,
      nowIso(),
    ],
  );
};

export const getNextTrackingSequence = async (deviceId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ max_sequence_no: number | null }>(
    'SELECT MAX(sequence_no) AS max_sequence_no FROM gps_points_queue WHERE device_id = ?',
    [deviceId],
  );
  return (row?.max_sequence_no ?? 0) + 1;
};

export const enqueueTrackingPoint = async (
  deviceId: string,
  sequenceNo: number,
  point: TrackingPointDraft,
): Promise<void> => {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO gps_points_queue (
      device_id,
      sequence_no,
      captured_at,
      lat,
      lng,
      accuracy_m,
      speed_mps,
      heading_deg,
      altitude_m,
      battery_level,
      is_mock,
      source,
      state,
      job_id,
      client_candidate_id,
      sync_status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      deviceId,
      sequenceNo,
      point.captured_at,
      point.lat,
      point.lng,
      point.accuracy_m ?? null,
      point.speed_mps ?? null,
      point.heading_deg ?? null,
      point.altitude_m ?? null,
      point.battery_level ?? null,
      toBooleanInt(Boolean(point.is_mock)),
      point.source ?? 'manual',
      point.state ?? 'standby',
      point.job_id ?? null,
      point.client_candidate_id ?? null,
      timestamp,
      timestamp,
    ],
  );
};

export const listQueuedTrackingPoints = async (
  deviceId: string,
  limit = 20,
): Promise<TrackingQueuePoint[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    `SELECT *
    FROM gps_points_queue
    WHERE device_id = ?
    ORDER BY sequence_no DESC
    LIMIT ?`,
    [deviceId, limit],
  );
  return rows.map(mapQueueRow);
};

export const listRetryableTrackingPoints = async (
  deviceId: string,
  limit: number,
): Promise<TrackingQueuePoint[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    `SELECT *
    FROM gps_points_queue
    WHERE device_id = ?
      AND sync_status IN ('pending', 'failed')
    ORDER BY sequence_no ASC
    LIMIT ?`,
    [deviceId, limit],
  );
  return rows.map(mapQueueRow);
};

export const markTrackingPointsSending = async (localIds: number[]): Promise<void> => {
  if (!localIds.length) {
    return;
  }
  const db = await getDatabase();
  const placeholders = localIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE gps_points_queue
    SET sync_status = 'sending', error_message = NULL, updated_at = ?
    WHERE local_id IN (${placeholders})`,
    [nowIso(), ...localIds],
  );
};

export const markTrackingPointsAcked = async (
  deviceId: string,
  accepted: { sequence_no: number; server_point_id?: number | null }[],
): Promise<void> => {
  if (!accepted.length) {
    return;
  }
  const db = await getDatabase();
  const timestamp = nowIso();
  for (const item of accepted) {
    await db.runAsync(
      `UPDATE gps_points_queue
      SET sync_status = 'acked', server_point_id = ?, error_message = NULL, updated_at = ?
      WHERE device_id = ? AND sequence_no = ?`,
      [item.server_point_id ?? null, timestamp, deviceId, item.sequence_no],
    );
  }
};

export const markTrackingPointsFailed = async (
  deviceId: string,
  failed: { sequence_no: number; error?: string | null }[],
): Promise<void> => {
  if (!failed.length) {
    return;
  }
  const db = await getDatabase();
  const timestamp = nowIso();
  for (const item of failed) {
    await db.runAsync(
      `UPDATE gps_points_queue
      SET sync_status = 'failed', error_message = ?, updated_at = ?
      WHERE device_id = ? AND sequence_no = ?`,
      [item.error ?? 'Punto rechazado por el backend.', timestamp, deviceId, item.sequence_no],
    );
  }
};

export const markTrackingPointsBackToFailed = async (
  localIds: number[],
  errorMessage: string,
): Promise<void> => {
  if (!localIds.length) {
    return;
  }
  const db = await getDatabase();
  const placeholders = localIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE gps_points_queue
    SET sync_status = 'failed', error_message = ?, updated_at = ?
    WHERE local_id IN (${placeholders})`,
    [errorMessage, nowIso(), ...localIds],
  );
};

export const getTrackingQueueSummary = async (deviceId: string): Promise<TrackingQueueSummary> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CountRow>(
    `SELECT sync_status, COUNT(*) AS total
    FROM gps_points_queue
    WHERE device_id = ?
    GROUP BY sync_status`,
    [deviceId],
  );
  const nextSequenceNo = await getNextTrackingSequence(deviceId);
  const summary: TrackingQueueSummary = {
    pending: 0,
    sending: 0,
    acked: 0,
    failed: 0,
    total: 0,
    nextSequenceNo,
  };

  rows.forEach(row => {
    summary[row.sync_status] = row.total;
    summary.total += row.total;
  });

  return summary;
};

export const getTrackingSyncState = async (deviceId: string): Promise<{
  last_server_point_id: number | null;
  last_uploaded_sequence_no: number | null;
  last_sync_at: string | null;
  last_policy_version: number | null;
} | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT last_server_point_id, last_uploaded_sequence_no, last_sync_at, last_policy_version
    FROM gps_sync_state
    WHERE device_id = ?`,
    [deviceId],
  );
  return row ?? null;
};

export const saveTrackingSyncState = async (
  deviceId: string,
  payload: {
    last_server_point_id?: number | null;
    last_uploaded_sequence_no?: number | null;
    last_sync_at?: string | null;
    last_policy_version?: number | null;
  },
): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO gps_sync_state (
      device_id,
      last_server_point_id,
      last_uploaded_sequence_no,
      last_sync_at,
      last_policy_version,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      last_server_point_id = excluded.last_server_point_id,
      last_uploaded_sequence_no = excluded.last_uploaded_sequence_no,
      last_sync_at = excluded.last_sync_at,
      last_policy_version = excluded.last_policy_version,
      updated_at = excluded.updated_at`,
    [
      deviceId,
      payload.last_server_point_id ?? null,
      payload.last_uploaded_sequence_no ?? null,
      payload.last_sync_at ?? null,
      payload.last_policy_version ?? null,
      nowIso(),
    ],
  );
};
