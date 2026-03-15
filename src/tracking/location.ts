import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { enqueueTrackingPoint, getCachedTrackingPolicy, getNextTrackingSequence } from '@/database/tracking';
import type {
  TrackingPermissionState,
  TrackingPointDraft,
  TrackingPolicy,
  TrackingRuntimeState,
} from '@/src/tracking/types';
import { getCachedData, setCachedData } from '@/utils/cache';

export const TRACKING_DEVICE_ID_CACHE_KEY = 'tracking-device-id';
export const TRACKING_RUNTIME_CACHE_KEY = 'tracking-runtime-state';
export const TRACKING_LOCATION_TASK = 'sisa-tracking-location-task';

const defaultRuntimeState: TrackingRuntimeState = {
  isTrackingActive: false,
  lastLocalCaptureAt: null,
  lastPermissionCheckAt: null,
  lastStartAt: null,
  lastError: null,
};

let trackingTaskDefined = false;

const nowIso = () => new Date().toISOString();

const fallbackBackgroundPermission = () => ({
  status: 'unavailable',
  granted: false,
  canAskAgain: false,
});

const readBackgroundPermissionSafe = async () => {
  try {
    return await Location.getBackgroundPermissionsAsync();
  } catch (error) {
    await persistRuntimeState({
      lastError:
        error instanceof Error
          ? error.message
          : 'El binario actual no tiene ACCESS_BACKGROUND_LOCATION.',
    });
    return fallbackBackgroundPermission();
  }
};

const locationToDraft = (location: Location.LocationObject, policy: TrackingPolicy | null): TrackingPointDraft => ({
  captured_at: new Date(location.timestamp).toISOString(),
  lat: location.coords.latitude,
  lng: location.coords.longitude,
  accuracy_m: location.coords.accuracy ?? null,
  speed_mps: location.coords.speed ?? null,
  heading_deg: location.coords.heading ?? null,
  altitude_m: location.coords.altitude ?? null,
  is_mock: location.mocked ?? false,
  source: 'expo_location',
  state: policy?.tracking_profile ?? 'standby',
});

const persistRuntimeState = async (patch: Partial<TrackingRuntimeState>): Promise<TrackingRuntimeState> => {
  const current = (await getCachedData<TrackingRuntimeState>(TRACKING_RUNTIME_CACHE_KEY)) ?? defaultRuntimeState;
  const next = {
    ...current,
    ...patch,
  };
  await setCachedData(TRACKING_RUNTIME_CACHE_KEY, next);
  return next;
};

const buildLocationOptions = (policy: TrackingPolicy | null): Location.LocationTaskOptions => ({
  accuracy: policy?.high_accuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
  timeInterval: Math.max(15, policy?.sample_min_seconds ?? 60) * 1000,
  distanceInterval: Math.max(0, policy?.distance_filter_m ?? 0),
  mayShowUserSettingsDialog: true,
  activityType: Location.ActivityType.OtherNavigation,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'SISA tracking activo',
    notificationBody: 'Registrando ubicacion para sincronizar el GPS.',
    notificationColor: '#2C2546',
  },
});

const enqueueLocationSamples = async (locations: Location.LocationObject[]): Promise<void> => {
  const deviceId = await getCachedData<string>(TRACKING_DEVICE_ID_CACHE_KEY);
  if (!deviceId || !locations.length) {
    return;
  }

  const policy = await getCachedTrackingPolicy(deviceId);

  for (const location of locations) {
    const sequenceNo = await getNextTrackingSequence(deviceId);
    await enqueueTrackingPoint(deviceId, sequenceNo, locationToDraft(location, policy));
  }

  await persistRuntimeState({
    lastLocalCaptureAt: new Date(locations[locations.length - 1].timestamp).toISOString(),
    lastError: null,
  });
};

if (!trackingTaskDefined) {
  TaskManager.defineTask(TRACKING_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      await persistRuntimeState({ lastError: error.message ?? 'Error ejecutando la tarea GPS.' });
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    await enqueueLocationSamples(locations);
  });
  trackingTaskDefined = true;
}

export const getTrackingPermissionState = async (): Promise<TrackingPermissionState> => {
  const [servicesEnabled, foreground, background] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    readBackgroundPermissionSafe(),
  ]);

  const state: TrackingPermissionState = {
    servicesEnabled,
    foregroundStatus: foreground.status,
    backgroundStatus: background.status,
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canAskAgainForeground: foreground.canAskAgain,
    canAskAgainBackground: background.canAskAgain,
  };

  await persistRuntimeState({ lastPermissionCheckAt: nowIso() });
  return state;
};

export const requestTrackingPermissions = async (): Promise<TrackingPermissionState> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  let background = await readBackgroundPermissionSafe();

  if (foreground.granted) {
    try {
      background = await Location.requestBackgroundPermissionsAsync();
    } catch (error) {
      await persistRuntimeState({
        lastError:
          error instanceof Error
            ? error.message
            : 'No se pudo pedir el permiso background de GPS.',
      });
      background = fallbackBackgroundPermission();
    }
  }

  const state: TrackingPermissionState = {
    servicesEnabled: await Location.hasServicesEnabledAsync(),
    foregroundStatus: foreground.status,
    backgroundStatus: background.status,
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canAskAgainForeground: foreground.canAskAgain,
    canAskAgainBackground: background.canAskAgain,
  };

  await persistRuntimeState({ lastPermissionCheckAt: nowIso() });
  return state;
};

export const getStoredTrackingRuntimeState = async (): Promise<TrackingRuntimeState> => {
  return (await getCachedData<TrackingRuntimeState>(TRACKING_RUNTIME_CACHE_KEY)) ?? defaultRuntimeState;
};

export const isTrackingTaskStarted = async (): Promise<boolean> => {
  return Location.hasStartedLocationUpdatesAsync(TRACKING_LOCATION_TASK);
};

export const startTrackingTask = async (deviceId: string, policy: TrackingPolicy | null): Promise<void> => {
  await setCachedData(TRACKING_DEVICE_ID_CACHE_KEY, deviceId);

  const started = await isTrackingTaskStarted();
  if (!started) {
    await Location.startLocationUpdatesAsync(TRACKING_LOCATION_TASK, buildLocationOptions(policy));
  }

  await persistRuntimeState({
    isTrackingActive: true,
    lastStartAt: nowIso(),
    lastError: null,
  });
};

export const stopTrackingTask = async (): Promise<void> => {
  const started = await isTrackingTaskStarted();
  if (started) {
    await Location.stopLocationUpdatesAsync(TRACKING_LOCATION_TASK);
  }

  await persistRuntimeState({
    isTrackingActive: false,
    lastError: null,
  });
};

export const captureCurrentTrackingPoint = async (
  deviceId: string,
  policy: TrackingPolicy | null,
): Promise<number> => {
  await setCachedData(TRACKING_DEVICE_ID_CACHE_KEY, deviceId);

  const location = await Location.getCurrentPositionAsync({
    accuracy: policy?.high_accuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: true,
  });

  const sequenceNo = await getNextTrackingSequence(deviceId);
  await enqueueTrackingPoint(deviceId, sequenceNo, {
    ...locationToDraft(location, policy),
    source: 'expo_location_manual',
  });

  await persistRuntimeState({
    lastLocalCaptureAt: new Date(location.timestamp).toISOString(),
    lastError: null,
  });

  return sequenceNo;
};
