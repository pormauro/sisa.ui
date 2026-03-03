import { Platform } from 'react-native';

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

const buildAttachJobPath = (params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  return `/share/attach-job?${query.toString()}`;
};

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (Platform.OS === 'web' || !initial || !path) {
    return path;
  }

  if (path.startsWith('content://') || path.startsWith('file://')) {
    return buildAttachJobPath({ uri: path });
  }

  const streamUri = getQueryValue(path, [
    'android.intent.extra.STREAM',
    'S.android.intent.extra.STREAM',
    'stream',
    'uri',
  ]);

  if (!streamUri) {
    return path;
  }

  const name = getQueryValue(path, ['android.intent.extra.TITLE', 'title', 'name']);
  const mime = getQueryValue(path, ['type', 'mimeType']);
  const size = getQueryValue(path, ['size']);

  const params: Record<string, string> = { uri: streamUri };
  if (name) params.name = name;
  if (mime) params.mime = mime;
  if (size) params.size = size;

  return buildAttachJobPath(params);
}
