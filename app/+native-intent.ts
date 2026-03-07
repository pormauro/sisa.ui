import { Platform } from 'react-native';

import { recordShareDebug } from '@/utils/shareDebug';

const decodeSafely = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getQueryValue = (rawPath: string, keys: string[]): string | null => {
  const queryPart = rawPath.includes('?') ? rawPath.split('?')[1] : '';
  const params = new URLSearchParams(queryPart);

  for (const key of keys) {
    const direct = params.get(key);
    if (direct) {
      return decodeSafely(direct);
    }
  }

  return null;
};

const decodeRepeatedly = (value: string, maxIterations = 2): string => {
  let current = value;
  for (let i = 0; i < maxIterations; i += 1) {
    const decoded = decodeSafely(current);
    if (decoded === current) {
      break;
    }
    current = decoded;
  }

  return current;
};

const getStreamUriFromRawPath = (rawPath: string): string | null => {
  const decodedPath = decodeRepeatedly(rawPath, 3);
  const streamUriMatch = decodedPath.match(/(content:\/\/[\w\-./%:?=&+#~]+|file:\/\/[\w\-./%:?=&+#~]+)/i);
  if (!streamUriMatch?.[1]) {
    return null;
  }

  return decodeSafely(streamUriMatch[1]);
};

const isRootSchemePath = (path: string): boolean => {
  const normalized = decodeSafely(path).trim().toLowerCase();
  return normalized === 'sisa:///' || normalized === 'sisa://' || normalized === '/';
};

const buildAttachJobPath = (params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  return `/share/attach-job?${query.toString()}`;
};

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  recordShareDebug('native-intent:received', {
    path,
    initial,
    platform: Platform.OS,
  });

  if (Platform.OS === 'web' || !initial || !path) {
    recordShareDebug('native-intent:passthrough', {
      reason: 'web-or-not-initial-or-empty-path',
      path,
    });
    return path;
  }

  if (path.startsWith('content://') || path.startsWith('file://')) {
    const attachPath = buildAttachJobPath({ uri: path });
    recordShareDebug('native-intent:raw-uri', {
      path,
      attachPath,
    });
    return attachPath;
  }

  const streamUri = getQueryValue(path, [
    'android.intent.extra.STREAM',
    'S.android.intent.extra.STREAM',
    'stream',
    'uri',
  ]) ?? getStreamUriFromRawPath(path);

  if (!streamUri) {
    if (isRootSchemePath(path)) {
      recordShareDebug('native-intent:root-path-no-share-payload', { path });
      return path;
    }

    recordShareDebug('native-intent:no-stream-uri', { path });
    return path;
  }

  const name = getQueryValue(path, ['android.intent.extra.TITLE', 'title', 'name']);
  const mime = getQueryValue(path, ['type', 'mimeType']);
  const size = getQueryValue(path, ['size']);

  const params: Record<string, string> = { uri: streamUri };
  if (name) params.name = name;
  if (mime) params.mime = mime;
  if (size) params.size = size;

  const attachPath = buildAttachJobPath(params);

  recordShareDebug('native-intent:stream-uri-detected', {
    streamUri,
    name,
    mime,
    size,
    attachPath,
  });

  return attachPath;
}
