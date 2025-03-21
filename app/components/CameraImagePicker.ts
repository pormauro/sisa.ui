// sisa/app/utils/imageUtils.ts

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { BASE_URL, MAX_FILE_SIZE } from '../config/index';

/**
 * Solicita permisos para cámara o galería, abre la fuente de imagen
 * y retorna el objeto resultante de ImagePicker.
 * Se han agregado opciones para optimizar el uso de memoria y evitar reinicios.
 */
export async function pickImageFromSource(fromCamera: boolean) {
  try {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requieren permisos de cámara.');
        return null;
      }
      return await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
        exif: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requieren permisos de galería.');
        return null;
      }
      return await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        allowsEditing: false,
        exif: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
    }
  } catch (error: any) {
    Alert.alert('Error', error.message);
    return null;
  }
}

/**
 * Verifica y comprime/redimensiona la imagen hasta que su tamaño sea <= MAX_FILE_SIZE (1MB).
 * Realiza hasta 3 intentos reduciendo gradualmente el tamaño y la compresión.
 * Retorna el URI final de la imagen procesada.
 */
async function ensureUnderMaxSize(
  uri: string,
  originalWidth: number,
  originalHeight: number
): Promise<string> {
  let currentUri = uri;
  let width = originalWidth;
  let height = originalHeight;

  const maxPasses = 3;
  let compressQuality = 0.7;

  for (let attempt = 1; attempt <= maxPasses; attempt++) {
    const fileInfo = await FileSystem.getInfoAsync(currentUri);
    if (!fileInfo.exists || typeof fileInfo.size !== 'number') {
      return currentUri;
    }
    if (fileInfo.size <= MAX_FILE_SIZE) {
      return currentUri;
    }
    // Calcula el ratio para acercarse al límite
    const ratio = Math.sqrt(MAX_FILE_SIZE / fileInfo.size);
    const newWidth = Math.floor(width * Math.min(ratio, 0.9));
    const newHeight = Math.floor(height * Math.min(ratio, 0.9));

    const manipResult = await ImageManipulator.manipulateAsync(
      currentUri,
      [{ resize: { width: newWidth, height: newHeight } }],
      {
        compress: compressQuality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    currentUri = manipResult.uri;
    width = newWidth;
    height = newHeight;
    compressQuality = Math.max(compressQuality - 0.1, 0.3);
  }

  return currentUri;
}

/**
 * Flujo completo para:
 * 1. Elegir la imagen (cámara/galería)
 * 2. Asegurar que la imagen procesada esté por debajo de 1MB
 * 3. Retornar el URI final de la imagen
 */
export async function pickAndProcessImage(fromCamera: boolean): Promise<string | null> {
  try {
    const result = await pickImageFromSource(fromCamera);
    // Verifica si el usuario canceló la acción
    if (!result || result.canceled === true || (result as any).cancelled === true) {
      return null;
    }
    // En versiones modernas, el resultado contiene un array en result.assets
    const asset = result.assets ? result.assets[0] : result;
    if (!asset || !asset.uri) {
      return null;
    }
    const finalUri = await ensureUnderMaxSize(asset.uri, asset.width, asset.height);
    return finalUri;
  } catch (error: any) {
    Alert.alert('Error al seleccionar imagen', error.message);
    return null;
  }
}

/**
 * Sube la imagen (finalUri) al servidor usando multipart/form-data y retorna el file_id devuelto.
 */
export async function uploadImage(localUri: string, token: string): Promise<number | null> {
  try {
    let filename = localUri.split('/').pop() || 'photo.jpg';
    if (!/\.\w+$/.test(filename)) {
      filename = `${filename}.jpg`;
    }
    const match = /\.(\w+)$/.exec(filename);
    const type = match
      ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}`
      : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: filename,
      type,
    } as any);

    const uploadResponse = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      Alert.alert('Error', 'Error al subir archivo');
      return null;
    }

    const data = await uploadResponse.json();
    const fileId = data?.file?.id;
    return fileId || null;
  } catch (error: any) {
    Alert.alert('Error', error.message);
    return null;
  }
}
