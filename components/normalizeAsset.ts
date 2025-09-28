import * as FileSystem from 'expo-file-system/legacy';

export interface NormalizedAsset {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export const normalizeAsset = async (
  asset: Partial<{
    uri: string;
    fileName?: string;
    name?: string;
    type?: string;
    mimeType?: string;
    fileSize?: number;
    size?: number;
  }>
): Promise<NormalizedAsset | null> => {
  if (!asset.uri) return null;

  let name = asset.fileName || asset.name || 'archivo';
  if (!/\.\w+$/.test(name)) {
    // Agrega extensión por defecto si falta
    name += '.jpg';
  }

  const match = /\.(\w+)$/.exec(name);
  const extension = match?.[1]?.toLowerCase() || 'jpg';
  const type =
    asset.type ||
    asset.mimeType ||
    (extension === 'jpg' ? 'image/jpeg' : `application/${extension}`);

  const fileInfo = await FileSystem.getInfoAsync(asset.uri);
  const size =
    asset.fileSize ||
    asset.size ||
    (fileInfo.exists && 'size' in fileInfo ? (fileInfo as { size: number }).size : 0) ||
    0;

  return {
    uri: asset.uri,
    name,
    type,
    size,
  };
};
