import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

export type AttachmentKind = 'pdf' | 'binary' | 'generic';

export interface OpenAttachmentOptions {
  uri: string;
  mimeType?: string;
  fileName?: string;
  kind?: AttachmentKind;
  onInAppOpen?: () => void;
}

const isPdfMimeType = (mimeType?: string) =>
  (mimeType ?? '').toLowerCase().includes('pdf');

const isBinaryMimeType = (mimeType?: string) => {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase();
  return (
    normalized === 'application/octet-stream' ||
    normalized.includes('binary') ||
    normalized.includes('octet-stream')
  );
};

export const openAttachment = async ({
  uri,
  mimeType,
  fileName,
  kind,
  onInAppOpen,
}: OpenAttachmentOptions): Promise<boolean> => {
  if (!uri) {
    throw new Error('URI no válido para el archivo adjunto.');
  }

  const detectedKind: AttachmentKind =
    kind ?? (isPdfMimeType(mimeType) ? 'pdf' : isBinaryMimeType(mimeType) ? 'binary' : 'generic');

  if (Platform.OS === 'android') {
    if (uri.startsWith('data:')) {
      if (onInAppOpen) {
        onInAppOpen();
        return true;
      }
      throw new Error('No es posible abrir directamente URIs de datos en Android.');
    }

    const intentModule = await import('expo-intent-launcher');

    const androidUri = uri.startsWith('file://')
      ? await FileSystem.getContentUriAsync(uri)
      : uri;

    const type = mimeType?.trim() || (detectedKind === 'pdf' ? 'application/pdf' : 'application/octet-stream');

    await intentModule.startActivityAsync('android.intent.action.VIEW', {
      data: androidUri,
      type,
      flags: 1,
    });

    return true;
  }

  if (Platform.OS === 'ios') {
    if (detectedKind === 'pdf' || detectedKind === 'binary') {
      try {
        const canOpen = await Linking.canOpenURL(uri);
        if (canOpen) {
          await Linking.openURL(uri);
          return true;
        }
      } catch (linkError) {
        console.warn('Linking no pudo abrir el archivo, probando con WebBrowser.', linkError);
      }

      try {
        const result = await WebBrowser.openBrowserAsync(uri);
        return result.type !== 'cancel';
      } catch (browserError) {
        console.warn('WebBrowser no pudo abrir el archivo.', browserError);
        if (onInAppOpen) {
          onInAppOpen();
          return true;
        }
        throw browserError;
      }
    } else {
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType,
            dialogTitle: fileName ?? 'Compartir archivo',
          });
          return true;
        }
      } catch (shareError) {
        console.warn('No fue posible compartir el archivo.', shareError);
      }

      if (onInAppOpen) {
        onInAppOpen();
        return true;
      }

      throw new Error('No se pudo compartir el archivo.');
    }
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('La ventana del navegador no está disponible.');
    }

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
      return true;
    } catch (error) {
      console.warn('Fallo al crear Blob para el archivo. Intentando abrir directamente.', error);
      window.open(uri, '_blank', 'noopener,noreferrer');
      return true;
    }
  }

  if (onInAppOpen) {
    onInAppOpen();
    return true;
  }

  return false;
};

export default openAttachment;
