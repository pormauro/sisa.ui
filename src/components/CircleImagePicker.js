import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Text,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pickAndProcessImage, uploadImage } from '../utils/imageUtils';
import { BASE_URL } from '../config/index';
import { FileContext } from '../../contexts/FilesContext';

/**
 * Props:
 *  - fileId    : (opcional) ID de archivo en el servidor (number o string).
 *               Se resuelve vía FilesContext.getFile(fileId) (offline-first).
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
  const files = useContext(FileContext);

  const [loading, setLoading] = useState(false);
  const [internalUri, setInternalUri] = useState(null);
  const [hasError, setHasError] = useState(false);

  const normalizeFileId = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const loadFileFromServerFallback = async fId => {
    // Fallback ultra defensivo si el provider no está montado por alguna razón.
    // Usa /files/{id} (NO /get_file).
    try {
      setLoading(true);
      setHasError(false);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setHasError(true);
        return;
      }

      const response = await fetch(`${BASE_URL}/files/${fId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setInternalUri(reader.result);
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error(error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadViaFilesContext = async fId => {
    try {
      setLoading(true);
      setHasError(false);

      if (!files || typeof files.getFile !== 'function') {
        await loadFileFromServerFallback(fId);
        return;
      }

      const uri = await files.getFile(fId);
      if (uri) {
        setInternalUri(uri);
        setHasError(false);
      } else {
        setInternalUri(null);
        setHasError(true);
      }
    } catch (error) {
      console.warn('CircleImagePicker: no se pudo resolver fileId', fId, error);
      setInternalUri(null);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fId = normalizeFileId(fileId);

    if (imageUri) {
      setInternalUri(imageUri);
      setHasError(false);
      return;
    }

    if (fId) {
      setInternalUri(null);
      void loadViaFilesContext(fId);
      return;
    }

    setInternalUri(null);
    setHasError(false);
  }, [fileId, imageUri]);

  const handleSelectImage = () => {
    Alert.alert(
      'Seleccionar Imagen',
      '¿Deseas usar la cámara o la galería?',
      [
        { text: 'Cámara', onPress: () => pickAndUpload(true) },
        { text: 'Galería', onPress: () => pickAndUpload(false) },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const pickAndUpload = async fromCamera => {
    try {
      setLoading(true);

      const newUri = await pickAndProcessImage(fromCamera);
      if (!newUri) return;

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No se encontró token');
        return;
      }

      const newFileId = await uploadImage(newUri, token);

      if (!newFileId) {
        Alert.alert('Error', 'No se pudo subir la imagen');
        return;
      }

      setInternalUri(newUri);
      setHasError(false);

      if (onImageChange) onImageChange(newFileId);

      if (files && typeof files.getFile === 'function') {
        try {
          await files.getFile(newFileId);
        } catch {
          // ignore precache error
        }
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Error seleccionando/subiendo imagen');
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
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: 'blue',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0008',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    color: '#fff',
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0006',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
