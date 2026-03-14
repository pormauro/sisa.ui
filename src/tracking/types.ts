export type TrackingProfile =
  | 'disabled'
  | 'standby'
  | 'moving'
  | 'working'
  | 'high_precision'
  | string;

export interface TrackingPolicy {
  id?: number | null;
  version?: number | null;
  name?: string | null;
  tracking_enabled: boolean;
  tracking_profile: TrackingProfile;
  sample_min_seconds?: number | null;
  sample_max_seconds?: number | null;
  distance_filter_m?: number | null;
  high_accuracy?: boolean | null;
  visit_radius_m?: number | null;
  max_batch_size?: number | null;
  next_poll_after_seconds?: number | null;
  assignment_id?: number | null;
  device_id?: string | null;
}

export interface TrackingPointDraft {
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  altitude_m?: number | null;
  battery_level?: number | null;
  is_mock?: boolean;
  source?: string | null;
  state?: string | null;
  job_id?: number | null;
  client_candidate_id?: number | null;
}

export interface TrackingQueuePoint extends TrackingPointDraft {
  local_id: number;
  device_id: string;
  sequence_no: number;
  sync_status: 'pending' | 'sending' | 'acked' | 'failed';
  server_point_id?: number | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingQueueSummary {
  pending: number;
  sending: number;
  acked: number;
  failed: number;
  total: number;
  nextSequenceNo: number;
}

export interface TrackingStatusLocation {
  user_id?: number | null;
  point_id?: number | null;
  device_id?: string | null;
  captured_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  state?: string | null;
}

export interface TrackingStatus {
  tracking_enabled?: boolean | null;
  last_server_point_id?: number | null;
  device_id?: string | null;
  policy?: TrackingPolicy | null;
  location?: TrackingStatusLocation | null;
  [key: string]: unknown;
}

export interface NearbyClient {
  id: number;
  empresa_id?: number | null;
  name: string;
  address_id?: number | null;
  address_label?: string | null;
  ciudad?: string | null;
  calle?: string | null;
  numero?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
}

export interface TrackingNearbyResponse {
  source?: string;
  location?: TrackingStatusLocation | null;
  clients: NearbyClient[];
}

export interface TrackingSyncResult {
  accepted: number;
  rejected: number;
  attempted: number;
  lastServerPointId?: number | null;
}

export interface TrackingPermissionState {
  servicesEnabled: boolean;
  foregroundStatus: string;
  backgroundStatus: string;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
}

export interface TrackingRuntimeState {
  isTrackingActive: boolean;
  lastLocalCaptureAt: string | null;
  lastPermissionCheckAt: string | null;
  lastStartAt: string | null;
  lastError: string | null;
}
