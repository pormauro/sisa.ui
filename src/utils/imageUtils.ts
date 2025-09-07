// sisa/app/utils/imageUtils.ts

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { BASE_URL, MAX_FILE_SIZE } from '../config/index';

/**
 * Solicita permisos para cámara o galería, abre la fuente de imagen
 * y retorna el objeto resultante de ImagePicker.
 * 
 * NOTA: Se omiten 'allowsEditing' y 'aspect' para evitar reinicios/crashes en algunos Android.
 *       Se reduce la calidad a 0.7 (70%) para no generar archivos muy grandes de inicio.
 */
export async function pickImageFromSource(fromCamera: boolean) {
  if (fromCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requieren permisos de cámara.');
      return null;
    }
    return await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requieren permisos de galería.');
      return null;
    }
    return await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
    });
  }
}

/**
 * Verifica y comprime/redimensiona la imagen HASTA que su tamaño sea <= MAX_FILE_SIZE (1MB).
 * Realiza varias "pasadas" reduciendo gradualmente el tamaño y la compresión. 
 * Retorna el nuevo URI local de la imagen final bajo 1MB (o lo que defina MAX_FILE_SIZE).
 */
async function ensureUnderMaxSize(
  uri: string,
  originalWidth: number,
  originalHeight: number
): Promise<string> {
  let currentUri = uri;
  let width = originalWidth;
  let height = originalHeight;

  // Hasta 3 intentos para ir reduciendo
  const maxPasses = 3;
  // Empieza con una compresión razonable
  let compressQuality = 0.7;

  for (let attempt = 1; attempt <= maxPasses; attempt++) {
    const fileInfo = await FileSystem.getInfoAsync(currentUri);
    if (!fileInfo.exists || typeof fileInfo.size !== 'number') {
      // Si algo falla, salimos sin forzar
      return currentUri;
    }
    if (fileInfo.size <= MAX_FILE_SIZE) {
      // Ya estamos por debajo (o igual) al límite de 1MB
      return currentUri;
    }
    // Reducir dimensiones de forma aproximada para acercarnos a 1MB
    const ratio = Math.sqrt(MAX_FILE_SIZE / fileInfo.size);
    // Si ratio >= 1, significa que ya estamos "casi" sin necesidad de redimensionar
    // pero igual se comprime un poco más.
    const newWidth = Math.floor(width * Math.min(ratio, 0.9));
    const newHeight = Math.floor(height * Math.min(ratio, 0.9));

    // Procesar con ImageManipulator
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

    // Cada pasada bajamos más la compresión
    compressQuality -= 0.1;
    if (compressQuality < 0.3) {
      compressQuality = 0.3;
    }
  }

  // Después de los intentos, devolvemos el resultado (aunque quizás siga arriba de 1MB si la imagen era enorme)
  return currentUri;
}

/**
 * El flujo completo de:
 *  1. Elegir la imagen (cámara/galería)
 *  2. Asegurar que quede por debajo de 1MB (ensureUnderMaxSize)
 *  3. Retornar el URI local final de la imagen procesada
 */
export async function pickAndProcessImage(
  fromCamera: boolean
): Promise<{ uri: string; fileName: string } | null> {
  const result = await pickImageFromSource(fromCamera);
  // Verificamos si el usuario canceló
  if (!result || result.canceled === true || (result as any).cancelled === true) {
    return null;
  }
  // En SDKs modernos, result.assets es un array con los datos de la imagen
  const asset = result.assets ? result.assets[0] : result;
  if (!asset || !asset.uri) {
    return null;
  }
  // Llamamos a ensureUnderMaxSize para que el archivo no supere 1MB
  const finalUri = await ensureUnderMaxSize(asset.uri, asset.width, asset.height);
  const baseName = asset.fileName ? asset.fileName.replace(/\.[^/.]+$/, '') : 'photo';
  const fileName = `${baseName}.jpg`;
  return { uri: finalUri, fileName };
}

/**
 * Sube la imagen (finalUri) al servidor con multipart/form-data
 * y retorna el file_id devuelto por la API.
 */
export async function uploadImage(
  localUri: string,
  token: string,
  originalName?: string
): Promise<number | null> {
  try {
    let filename = originalName || localUri.split('/').pop() || 'photo.jpg';
    if (!/\.\w+$/.test(filename)) {
      filename = `${filename}.jpg`;
    }
    const match = /\.(\w+)$/.exec(filename);
    // Forzamos 'jpeg' si la extensión es '.jpg'
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
