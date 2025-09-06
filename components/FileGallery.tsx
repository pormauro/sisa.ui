import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Video from 'react-native-video';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { FileContext } from '@/contexts/FilesContext';
// @ts-ignore - types are not provided for this library
import ImageViewing from 'react-native-image-viewing';


interface FileGalleryProps {
  filesJson: string;
  onChangeFilesJson: (updatedJson: string) => void;
  editable?: boolean;
}

interface AttachedFile {
  id: number;
  originalName: string;
  fileType: string;
  previewUri: string;
  localUri: string;
  loading: boolean;
}

interface FileItemProps {
  file: AttachedFile;
  onDelete: (fileId: number) => void;
  onPreview: (index: number) => void;
  index: number;
  editable: boolean;
}

const FileItem: React.FC<FileItemProps> = ({ file, onDelete, onPreview, index, editable }) => {
  if (file.loading) {
    return (
      <View style={[styles.fileItem, styles.loadingContainer]}>
        <ActivityIndicator />
      </View>
    );
  }

  const lowerType = file.fileType.toLowerCase();
  const isImage = lowerType.includes('image');
  const isVideo = lowerType.includes('video');

  const handlePress = async () => {
    if (isImage || isVideo) {
      onPreview(index);
    } else {
      try {
        const contentUri = await FileSystem.getContentUriAsync(file.localUri);
        await Linking.openURL(contentUri);
      } catch (e) {
        console.error('Error opening file:', e);
        Alert.alert('Error', 'No se pudo abrir el archivo.');
      }
    }
  };

  return (
    <TouchableOpacity style={styles.fileItem} onPress={handlePress}>
      {isImage ? (
        <Image source={{ uri: file.previewUri }} style={styles.media} resizeMode="cover" />
      ) : isVideo ? (
        <Video source={{ uri: file.previewUri }} style={styles.media} resizeMode="cover" paused />
      ) : (
        <View style={[styles.media, styles.defaultIcon]}>          
          <Text style={styles.iconText}>{file.originalName}</Text>
        </View>
      )}
      {editable && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(file.id)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const FileGallery: React.FC<FileGalleryProps> = ({ filesJson, onChangeFilesJson, editable = false }) => {
  const { uploadFile, getFile, getFileMetadata } = useContext(FileContext);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isEditable = !!editable;

  const handleSelectSource = () => {
    Alert.alert(
      'Seleccionar origen',
      '¿De dónde quieres obtener el archivo?',
      [
        { text: 'Cámara', onPress: handleAddCameraFile },
        { text: 'Archivos', onPress: handleAddFile },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

// 2) Función handleAddCameraFile actualizada:
const handleAddCameraFile = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesito permiso para usar la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
      base64: false,
    });
    // Nuevo guard:
    if (result.canceled || !result.assets?.length) return;

    // Extrae el asset:
    const asset = result.assets[0];
    const picked = {
      uri: asset.uri,
      name: asset.fileName || asset.uri.split('/').pop() || 'camera.jpg',
      type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
      size: asset.fileSize ?? 0,
    };

    // Reusa el flujo de subida:
    const fileData = await uploadFile(picked.uri, picked.name, picked.type, picked.size);
    if (!fileData) {
      Alert.alert('Error', 'No se pudo subir el archivo de cámara.');
      return;
    }

    // Placeholder y subida de preview/metadata:
    const placeholder: AttachedFile = {
      id: fileData.id,
      previewUri: '',
      fileType: '',
      originalName: '',
      localUri: '',
      loading: true,
    };
    setAttachedFiles(prev => {
      const newArr = [...prev, placeholder];
      onChangeFilesJson(JSON.stringify(newArr.map(f => f.id)));
      return newArr;
    });

    const dataUri = await getFile(fileData.id);
    const metadata = await getFileMetadata(fileData.id);
    setAttachedFiles(prev =>
      prev.map(f =>
        f.id === fileData.id
          ? {
              id: f.id,
              previewUri: dataUri ?? '',
              fileType: metadata?.file_type ?? '',
              originalName: metadata?.original_name ?? '',
              localUri: metadata?.localUri ?? '',
              loading: false,
            }
          : f
      )
    );
  } catch (error: any) {
    console.error('Error cámara:', error);
    Alert.alert('Error', error.message);
  }
};

  useEffect(() => {
    const loadPlaceholders = () => {
      try {
        const ids: number[] = filesJson ? JSON.parse(filesJson) : [];
        const placeholders = ids.map(
          id => ({
            id,
            previewUri: '',
            fileType: '',
            originalName: '',
            localUri: '',
            loading: true,
          } as AttachedFile)
        );
        setAttachedFiles(placeholders);

        ids.forEach(async (id, idx) => {
          try {
            const [dataUri, metadata] = await Promise.all([
              getFile(id),
              getFileMetadata(id)
            ]);

            const fileType = metadata?.file_type ?? '';
            const originalName = metadata?.original_name ?? '';
            const localUri = metadata?.localUri ?? '';

            setAttachedFiles(prev => {
              const copy = [...prev];
              copy[idx] = {
                id,
                previewUri: dataUri || '',
                fileType,
                originalName,
                localUri,
                loading: false,
              };
              return copy;
            });
          } catch (e) {
            console.error(`Error loading file ${id}:`, e);
            setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
          }
        });
      } catch (error) {
        console.error('Error parsing filesJson:', error);
        Alert.alert('Error', 'Formato inválido en filesJson.');
      }
    };
    loadPlaceholders();
  }, [filesJson, getFile, getFileMetadata]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result?.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        };
      }
      return null;
    } catch (error) {
      console.error('Error seleccionando documento:', error);
      return null;
    }
  };

  const handleAddFile = async () => {
    try {
      const picked = await pickFile();
      if (!picked) return;
      let fileUri = picked.uri;
      if (!fileUri.startsWith('file://')) {
        const newUri = FileSystem.cacheDirectory + picked.name;
        await FileSystem.copyAsync({ from: fileUri, to: newUri });
        fileUri = newUri;
      }

      const fileData = await uploadFile(fileUri, picked.name, picked.type, picked.size);
      if (!fileData) {
        Alert.alert('Error', 'No se pudo subir el archivo.');
        return;
      }

      const placeholder: AttachedFile = {
        id: fileData.id,
        previewUri: '',
        fileType: '',
        originalName: '',
        localUri: '',
        loading: true,
      };
      setAttachedFiles(prev => {
        const newArr = [...prev, placeholder];
        onChangeFilesJson(JSON.stringify(newArr.map(f => f.id)));
        return newArr;
      });

      const dataUri = await getFile(fileData.id);
      const metadata = await getFileMetadata(fileData.id);
      const fileType = metadata?.file_type ?? '';
      const originalName = metadata?.original_name ?? '';
      const localUri = metadata?.localUri ?? '';

      setAttachedFiles(prev =>
        prev.map(f =>
          f.id === fileData.id
            ? { id: f.id, previewUri: dataUri ?? '', fileType, originalName, localUri, loading: false }
            : f
        )
      );
    } catch (error: any) {
      console.error('Error agregando archivo:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteFile = (id: number) => {
    setAttachedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      onChangeFilesJson(JSON.stringify(filtered.map(f => f.id)));
      return filtered;
    });
  };

  const renderPreviewModal = () => {
    if (previewIndex === null) return null;

    const current = attachedFiles[previewIndex];
    const lowerType = current.fileType.toLowerCase();
    const isImage = lowerType.includes('image');
    const isVideo = lowerType.includes('video');

    if (isImage) {
      const imageFiles = attachedFiles.filter(f => f.fileType.toLowerCase().includes('image'));
      const imageIndex = imageFiles.findIndex(f => f.id === current.id);
      return (
        <ImageViewing
          images={imageFiles.map(f => ({ uri: f.previewUri }))}
          imageIndex={imageIndex}
          visible={true}
          onRequestClose={() => setPreviewIndex(null)}
          FooterComponent={({ imageIndex }: { imageIndex: number }) => (
            <View style={styles.modalTopOverlay}>
              <Text style={styles.modalIndex}>{imageIndex + 1} / {imageFiles.length}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreviewIndex(null)}>
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }

    if (isVideo) {
      return (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
          <View style={styles.modalOverlay}>
            <Video source={{ uri: current.previewUri }} style={styles.fullImage} resizeMode="contain" controls />
            <View style={styles.modalTopOverlay}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreviewIndex(null)}>
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    return null;
  };

  return (
    <>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
      >
        {attachedFiles.map((file, idx) => (
          <FileItem
            key={file.id.toString()}
            file={file}
            index={idx}
            onDelete={handleDeleteFile}
            onPreview={setPreviewIndex}
            editable={isEditable}
          />
        ))}
        {isEditable && (
          <TouchableOpacity style={[styles.fileItem, styles.addFileItem]} onPress={handleSelectSource}>
            <Text style={styles.addButtonText}>Add File</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {renderPreviewModal()}
    </>
  );
};

export default FileGallery;

const styles = StyleSheet.create({
  carouselContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  fileItem: {
    width: 250,
    height: 200,
    marginHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    backgroundColor: '#ddd',
  },  
  media: {
    width: '100%',
    height: '100%',
  },
  defaultIcon: {
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#555',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  addFileItem: {
    backgroundColor: '#007bff',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#fff',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  modalTopOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
  },
  modalIndex: {
    color: '#fff',
    fontSize: 16,
  },
});
