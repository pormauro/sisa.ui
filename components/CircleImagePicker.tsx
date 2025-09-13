// C:/Users/Mauri/Documents/GitHub/router/components/CircleImagePicker.tsx

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Text,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { MAX_FILE_SIZE } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { FileContext } from '@/contexts/FilesContext';

/**
 * Props del componente CircleImagePicker.
 */
interface CircleImagePickerProps {
  /**
   * ID de archivo en el servidor. Si se proporciona, se descargará la imagen.
   */
  fileId?: string | null;
  /**
   * URI local (o remota) a usar directamente.
   * Tiene prioridad sobre fileId.
   */
  imageUri?: string | null;
  /**
   * Indica si se muestra el ícono de cámara para cambiar la imagen.
   */
  editable?: boolean;
  /**
   * Tamaño (ancho/alto) del círculo.
   */
  size?: number;
  /**
   * Callback que se dispara cuando se sube con éxito una nueva imagen
   * y se obtiene un nuevo fileId del servidor.
   */
  onImageChange?: (newFileId: string) => void;
  /**
   * Indica si se debe recortar la imagen tras seleccionarla.
   */
  crop?: boolean;
  /**
   * Razón de aspecto para el recorte (por ejemplo, 1 para 1:1).
   * Si no se especifica, se usa 1 (cuadrado).
   */
  cropAspect?: number;
  /**
   * Estilo adicional para el contenedor principal.
   */
  style?: StyleProp<ViewStyle>;
}

export default function CircleImagePicker({
  fileId = null,
  imageUri = null,
  editable = false,
  size = 80,
  crop = false,
  cropAspect = 1,
  onImageChange,
  style,
}: CircleImagePickerProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(false);
  const [internalUri, setInternalUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const { token } = useContext(AuthContext);
  // Se importan las funciones del contexto FileContext
  const { uploadFile, getFile } = useContext(FileContext);

  // Cargar la imagen según imageUri o fileId
  useEffect(() => {
    if (imageUri) {
      setInternalUri(imageUri);
      setHasError(false);
    } else if (fileId) {
      void loadFileFromServer(fileId);
    } else {
      setInternalUri(null);
      setHasError(false);
    }
  }, [fileId, imageUri]);

  /**
   * Descarga la imagen desde el servidor usando un fileId.
   */
  const loadFileFromServer = async (fId: string) => {
    try {
      setLoading(true);
      setHasError(false);
      if (!token) {
        setHasError(true);
        setLoading(false);
        return;
      }
      // Usamos getFile del contexto, que maneja la caché
      const uri = await getFile(parseInt(fId));
      if (uri) {
        setInternalUri(uri);
        setHasError(false);
      } else {
        setHasError(true);
      }
      setLoading(false);
     
    } catch (error) {
      console.error(error);
      setHasError(true);
      setLoading(false);
    }
  };

  /**
   * Solicita permisos y abre la fuente de imagen (cámara o galería).
   */
  const pickImageFromSource = async (fromCamera: boolean) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requieren permisos de cámara.');
        return null;
      }
      return await ImagePicker.launchCameraAsync({ quality: 0.7 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requieren permisos de galería.');
        return null;
      }
      return await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    }
  };

  /**
   * Recorta la imagen de forma centrada según el aspecto deseado.
   */
  const cropImage = async (
    uri: string,
    aspect: number,
    width: number,
    height: number
  ): Promise<string> => {
    let cropWidth = width;
    let cropHeight = height;
    let originX = 0;
    let originY = 0;
    const currentRatio = width / height;
    if (currentRatio > aspect) {
      cropWidth = height * aspect;
      originX = (width - cropWidth) / 2;
    } else {
      cropHeight = width / aspect;
      originY = (height - cropHeight) / 2;
    }
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
          },
        },
      ],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  /**
   * Comprueba y reduce la imagen para que quede por debajo de MAX_FILE_SIZE.
   */
  const ensureUnderMaxSize = async (
    uri: string,
    originalWidth: number,
    originalHeight: number
  ): Promise<string> => {
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
      const ratio = Math.sqrt(MAX_FILE_SIZE / fileInfo.size);
      const newWidth = Math.floor(width * Math.min(ratio, 0.9));
      const newHeight = Math.floor(height * Math.min(ratio, 0.9));
      const manipResult = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
      );
      currentUri = manipResult.uri;
      width = newWidth;
      height = newHeight;
      compressQuality = Math.max(compressQuality - 0.1, 0.3);
    }
    return currentUri;
  };

  /**
   * Flujo completo: seleccionar imagen, (opcional) recortar, comprimir y retornar el URI.
   */
  const pickAndProcessImage = async (fromCamera: boolean): Promise<string | null> => {
    const result = await pickImageFromSource(fromCamera);
    if (!result || result.canceled === true || (result as any).cancelled === true) {
      return null;
    }
    const asset = result.assets ? result.assets[0] : result;
    if (!asset || !asset.uri || !asset.width || !asset.height) {
      return null;
    }
    let processedUri = asset.uri;
    if (crop) {
      processedUri = await cropImage(processedUri, cropAspect, asset.width, asset.height);
    }
    processedUri = await ensureUnderMaxSize(processedUri, asset.width, asset.height);
    return processedUri;
  };

  /**
   * Maneja la selección de imagen mostrando un Alert para elegir entre cámara o galería.
   */
  const handleSelectImage = () => {
    Alert.alert(
      'Seleccionar Imagen',
      '¿Deseas usar la cámara o la galería?',
      [
        { text: 'Cámara', onPress: () => void pickAndUpload(true) },
        { text: 'Galería', onPress: () => void pickAndUpload(false) },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  /**
   * Abre la cámara o la galería, procesa la imagen y la sube al servidor.
   * Se llama a uploadFile con los cuatro parámetros requeridos.
   */
  const pickAndUpload = async (fromCamera: boolean) => {
    try {
      setLoading(true);
      const newUri = await pickAndProcessImage(fromCamera);
      if (!newUri) {
        setLoading(false);
        return;
      }
      if (!token) {
        Alert.alert('Error', 'No se encontró token');
        setLoading(false);
        return;
      }
      // Obtener el tamaño del archivo para subir
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      const fileSize = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;
      let filename = newUri.split('/').pop() || 'photo.jpg';
      if (!/\.\w+$/.test(filename)) {
        filename = `${filename}.jpg`;
      }
      const match = /\.(\w+)$/.exec(filename);
      const fileType =
        match && match[1].toLowerCase() === 'jpg'
          ? 'image/jpeg'
          : match
          ? `image/${match[1].toLowerCase()}`
          : 'image/jpeg';

      // Llamada a uploadFile con los parámetros: URI, filename, fileType y fileSize
      const fileData = await uploadFile(newUri, filename, fileType, fileSize);
      if (fileData) {
        setInternalUri(newUri);
        setHasError(false);
        if (onImageChange) {
          onImageChange(fileData.id.toString());
        }
      } else {
        Alert.alert('Error', 'No se pudo subir la imagen');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.container, style, circleStyle]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
      {internalUri && !hasError ? (
        <Image
          source={{ uri: internalUri }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
            loading && { opacity: 0.4 },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.placeholder, circleStyle]} />
      )}
      {editable && !loading && (
        <TouchableOpacity style={styles.cameraButton} onPress={handleSelectImage}>
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    zIndex: 2,
  },
  image: {
    // Se define a nivel de props en el <Image>
  },
  placeholder: {
    backgroundColor: 'blue',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '30%',
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  cameraIcon: {
    color: '#fff',
    fontSize: 32,
  },
});
