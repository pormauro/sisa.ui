// app/components/CircleImagePicker.js
import React, { useState, useEffect } from 'react';
import { 
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Text
} from 'react-native';
import { pickAndProcessImage, uploadImage } from '../utils/imageUtils';
import { BASE_URL } from '../config/index';
import { getItem } from '@/utils/auth/secureStore';

/**
 * Componente para mostrar la imagen en un círculo. Puede ser:
 * - Sólo lectura (editable={false}), sin botón de cámara.
 * - Editable (editable={true}), con botón de cámara para cambiar la imagen.
 * 
 * Props:
 *  - fileId    : (opcional) ID de archivo en el servidor. Se descargará la imagen de /get_file?file_id=xxx
 *  - imageUri  : (opcional) URI local (o remota) a usar directamente.
 *  - editable  : boolean que indica si se muestra el icono de cámara.
 *  - onImageChange(newFileId) : callback cuando se sube con éxito una imagen y se obtiene un nuevo fileId.
 *  - size      : tamaño del círculo (ancho/alto).
 */
export default function CircleImagePicker({
  fileId = null,
  imageUri = null,
  editable = false,
  size = 80,
  onImageChange,
  style,
}) {
  const [loading, setLoading] = useState(false);
  const [internalUri, setInternalUri] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (imageUri) {
      // Usar directamente la URI pasada
      setInternalUri(imageUri);
      setHasError(false);
    } else if (fileId) {
      // Cargar la imagen desde el servidor
      loadFileFromServer(fileId);
    } else {
      // No hay imagen
      setInternalUri(null);
      setHasError(false);
    }
  }, [fileId, imageUri]);

  const loadFileFromServer = async (fId) => {
    try {
      setLoading(true);
      setHasError(false);
      const token = await getItem('token');
      if (!token) {
        setHasError(true);
        setLoading(false);
        return;
      }
      const response = await fetch(`${BASE_URL}/get_file?file_id=${fId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setInternalUri(reader.result);
          setLoading(false);
        };
        reader.readAsDataURL(blob);
      } else {
        setHasError(true);
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setHasError(true);
      setLoading(false);
    }
  };

  // Abre cámara o galería, sube la imagen
  const handleSelectImage = () => {
    Alert.alert(
      'Seleccionar Imagen',
      '¿Deseas usar la cámara o la galería?',
      [
        { text: 'Cámara', onPress: () => pickAndUpload(true) },
        { text: 'Galería', onPress: () => pickAndUpload(false) },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const pickAndUpload = async (fromCamera) => {
    try {
      setLoading(true);
      const newUri = await pickAndProcessImage(fromCamera);
      if (!newUri) {
        // Usuario canceló
        setLoading(false);
        return;
      }
      const token = await getItem('token');
      if (!token) {
        Alert.alert('Error', 'No se encontró token');
        setLoading(false);
        return;
      }

      // Subir la imagen
      const newFileId = await uploadImage(newUri, token);
      if (newFileId) {
        setInternalUri(newUri);
        setHasError(false);
        if (onImageChange) {
          onImageChange(newFileId);
        }
      } else {
        Alert.alert('Error', 'No se pudo subir la imagen');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar el tamaño (width/height) dinámicamente
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

      {/* Mostrar la imagen si tenemos URI, o un placeholder azul */}
      {internalUri && !hasError ? (
        <Image
          source={{ uri: internalUri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }, loading && { opacity: 0.4 }]}
        />
      ) : (
        <View style={[styles.image, styles.placeholder, circleStyle]} />
      )}

      {/* Botón de cámara si es editable */}
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
    resizeMode: 'cover',
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
    borderRadius: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  cameraIcon: {
    color: '#fff',
    fontSize: 32,
  },
});
