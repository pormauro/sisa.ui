import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
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
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { FileContext } from '@/contexts/FilesContext';
// @ts-ignore - types are not provided for this library
import ImageViewing from 'react-native-image-viewing';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { openAttachment } from '@/utils/files/openAttachment';


interface FileGalleryProps {
  filesJson: string;
  onChangeFilesJson: (updatedJson: string) => void;
  editable?: boolean;
  invoiceMarkingEnabled?: boolean;
}

interface AttachedFile {
  id: number;
  originalName: string;
  fileType: string;
  previewUri: string;
  localUri: string;
  loading: boolean;
  isInvoice?: boolean;
}

interface FileItemProps {
  file: AttachedFile;
  onDelete: (fileId: number) => void;
  onPreview: (index: number) => void;
  onPreviewPdf: (uri: string) => void;
  index: number;
  editable: boolean;
  showInvoiceToggle: boolean;
  onToggleInvoice?: (fileId: number) => void;
}

const VideoThumbnail: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri);
  return (
    <VideoView player={player} style={styles.media} contentFit="cover" nativeControls />
  );
};

const VideoPreviewModal: React.FC<{ uri: string; onClose: () => void }> = ({ uri, onClose }) => {
  const player = useVideoPlayer(uri);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <VideoView player={player} style={styles.fullImage} contentFit="contain" nativeControls />
        <View style={styles.modalTopOverlay}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ImagePreviewModal: React.FC<{
  images: AttachedFile[];
  initialIndex: number;
  onClose: () => void;
}> = ({ images, initialIndex, onClose }) => (
  <ImageViewing
    images={images.map(f => ({ uri: f.previewUri }))}
    imageIndex={initialIndex}
    visible
    onRequestClose={onClose}
    FooterComponent={({ imageIndex }: { imageIndex: number }) => (
      <View style={styles.modalTopOverlay}>
        <Text style={styles.modalIndex}>{imageIndex + 1} / {images.length}</Text>
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <Text style={styles.modalCloseText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    )}
  />
);

interface PdfThumbnailProps {
  title: string;
}

const PdfThumbnail: React.FC<PdfThumbnailProps> = ({ title }) => {
  const displayName = useMemo(
    () => (title && title.trim().length > 0 ? title.trim() : 'Documento PDF'),
    [title]
  );

  return (
    <View style={styles.pdfThumbnailWrapper}>
      <View style={styles.pdfPlaceholder}>
        <MaterialCommunityIcons name="file-pdf-box" size={48} color="#d32f2f" />
        <Text style={styles.pdfPlaceholderTitle} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={styles.pdfPlaceholderHint}>Toca para abrir</Text>
      </View>
    </View>
  );
};

const iframeStyle: React.CSSProperties = {
  border: 'none',
  width: '100%',
  height: '100%',
};

const PdfViewer: React.FC<{ uri: string }> = ({ uri }) => {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fullImage, styles.pdfWebContainer]}>
        <iframe
          src={uri}
          title="Visor PDF"
          style={iframeStyle}
        />
      </View>
    );
  }

  const allowingReadAccessToURL = uri.startsWith('file://')
    ? uri.replace(/[^/]+$/, '')
    : undefined;

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ uri }}
      style={styles.fullImage}
      startInLoadingState
      allowFileAccess
      allowingReadAccessToURL={allowingReadAccessToURL}
      renderLoading={() => (
        <View style={styles.pdfLoading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    />
  );
};

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onPreviewPdf,
  index,
  editable,
  showInvoiceToggle,
  onToggleInvoice,
}) => {
  const longPressHandledRef = useRef(false);

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
  const isPdf = lowerType.includes('pdf');

  const handleLongPress = () => {
    if (!showInvoiceToggle || !editable) return;
    longPressHandledRef.current = true;
    onToggleInvoice?.(file.id);
  };

  const handlePress = async () => {
    if (isImage || isVideo) {
      onPreview(index);
    } else if (isPdf) {
      try {
        const uri = file.localUri || file.previewUri;
        if (!uri) {
          Alert.alert('Error', 'El archivo PDF no está disponible.');
          return;
        }

        const opened = await openAttachment({
          uri,
          mimeType: file.fileType,
          fileName: file.originalName,
          kind: 'pdf',
          onInAppOpen: () => onPreviewPdf(uri),
        });

        if (!opened) {
          onPreviewPdf(uri);
        }
      } catch (e: any) {
        console.error('Error opening PDF:', e);
        const message =
          Platform.OS === 'android' && typeof e?.message === 'string' &&
          e.message.toLowerCase().includes('activity')
            ? 'No se encontró una aplicación instalada para abrir archivos PDF.'
            : 'No se pudo abrir el PDF.';
        Alert.alert('Error', message);
      }
    } else {
      if (!file.localUri) {
        Alert.alert('Error', 'El archivo no está disponible localmente.');
        return;
      }

      try {
        const openKind = lowerType.includes('octet-stream') ? 'binary' : 'generic';

        await openAttachment({
          uri: file.localUri,
          mimeType: file.fileType,
          fileName: file.originalName,
          kind: openKind,
        });
      } catch (e: any) {
        console.error('Error opening file:', e);
        const message =
          Platform.OS === 'android'
            ? 'No se encontró una aplicación instalada para abrir este tipo de archivo.'
            : 'No se pudo abrir el archivo.';
        Alert.alert('Error', message);
      }
    }
  };

  const handlePressWrapper = () => {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      return;
    }
    void handlePress();
  };

  return (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={handlePressWrapper}
      onLongPress={handleLongPress}
      delayLongPress={300}
    >
      {showInvoiceToggle && (
        <TouchableOpacity
          style={styles.invoiceToggle}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            if (!editable) return;
            onToggleInvoice?.(file.id);
          }}
          disabled={!editable}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={24}
            color={file.isInvoice ? '#2e7d32' : '#9e9e9e'}
          />
        </TouchableOpacity>
      )}
      {showInvoiceToggle && file.isInvoice && (
        <View style={styles.invoiceBadge} pointerEvents="none">
          <MaterialCommunityIcons name="file-document-check-outline" size={16} color="#fff" />
          <Text style={styles.invoiceBadgeText}>IS IN VOICE</Text>
        </View>
      )}
      <View style={[styles.previewContainer, file.isInvoice && styles.invoicePreview]}>
        {file.isInvoice && (
          <View style={styles.invoiceOverlay} pointerEvents="none">
            <MaterialCommunityIcons name="file-document-check-outline" size={24} color="#2e7d32" />
          </View>
        )}
        {isImage ? (
          <Image source={{ uri: file.previewUri }} style={styles.media} resizeMode="cover" />
        ) : isVideo ? (
          <VideoThumbnail uri={file.previewUri} />
        ) : isPdf ? (
          <PdfThumbnail title={file.originalName} />
        ) : (
          <View style={[styles.media, styles.defaultIcon]}>
            <Text style={styles.iconText}>{file.originalName}</Text>
          </View>
        )}
      </View>
      {editable && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(file.id)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const PdfPreviewModal: React.FC<{ uri: string; onClose: () => void }> = ({ uri, onClose }) => {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <PdfViewer uri={uri} />
        <View style={styles.modalTopOverlay}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const FileGallery: React.FC<FileGalleryProps> = ({
  filesJson,
  onChangeFilesJson,
  editable = false,
  invoiceMarkingEnabled = false,
}) => {
  const { uploadFile, getFile, getFileMetadata } = useContext(FileContext);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [pdfPreviewUri, setPdfPreviewUri] = useState<string | null>(null);
  const isEditable = !!editable;

  const syncFilesJson = (files: AttachedFile[]) => {
    if (invoiceMarkingEnabled) {
      const payload = files.map(f => ({
        id: f.id,
        ...(f.isInvoice ? { is_invoice: true } : {}),
      }));
      onChangeFilesJson(JSON.stringify(payload));
      return;
    }

    onChangeFilesJson(JSON.stringify(files.map(f => f.id)));
  };

  const parseFileDescriptors = useCallback((): { id: number; isInvoice: boolean }[] => {
    if (!filesJson) return [] as { id: number; isInvoice: boolean }[];

    const parsed = JSON.parse(filesJson);
    if (!Array.isArray(parsed)) {
      throw new Error('Formato inválido en filesJson');
    }

    const toInvoiceFlag = (item: any) => {
      const metadata = item?.metadata;
      const metadataInvoice =
        metadata && typeof metadata === 'object'
          ? metadata.is_invoice ?? metadata.isInvoice
          : undefined;

      return (item?.is_invoice ?? item?.isInvoice ?? metadataInvoice) as
        | boolean
        | undefined;
    };

    return parsed
      .map(item => {
        if (typeof item === 'number') {
          return { id: item, isInvoice: false };
        }

        if (item && typeof item === 'object') {
          const candidateId = (item as any).id;
          const id = Number(candidateId);
          if (Number.isNaN(id)) {
            return null;
          }

          const isInvoice = Boolean(toInvoiceFlag(item));
          return { id, isInvoice };
        }

        return null;
      })
      .filter((item): item is { id: number; isInvoice: boolean } => !!item);
  }, [filesJson]);

  const handlePreviewPdf = (uri: string) => {
    setPreviewIndex(null);
    setPdfPreviewUri(uri);
  };

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
      isInvoice: false,
    };
    setAttachedFiles(prev => {
      const newArr = [...prev, placeholder];
      syncFilesJson(newArr);
      return newArr;
    });

    const dataUri = await getFile(fileData.id);
    const metadata = await getFileMetadata(fileData.id);
    setAttachedFiles(prev =>
      prev.map(f => {
        const metadataInvoice = (metadata as any)?.is_invoice ?? (metadata as any)?.isInvoice;
        return f.id === fileData.id
          ? {
              id: f.id,
              previewUri: dataUri ?? '',
              fileType: metadata?.file_type ?? '',
              originalName: metadata?.original_name ?? '',
              localUri: metadata?.localUri ?? '',
              loading: false,
              isInvoice: metadataInvoice ?? f.isInvoice ?? false,
            }
          : f;
      })
    );
  } catch (error: any) {
    console.error('Error cámara:', error);
    Alert.alert('Error', error.message);
  }
};

  useEffect(() => {
    const loadPlaceholders = () => {
      try {
        const descriptors = parseFileDescriptors();
        const placeholders = descriptors.map(
          ({ id, isInvoice }) => ({
            id,
            previewUri: '',
            fileType: '',
            originalName: '',
            localUri: '',
            loading: true,
            isInvoice,
          } as AttachedFile)
        );
        setAttachedFiles(placeholders);

        descriptors.forEach(async ({ id, isInvoice }, idx) => {
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
              const metadataInvoice = (metadata as any)?.is_invoice ?? (metadata as any)?.isInvoice;
              copy[idx] = {
                id,
                previewUri: dataUri || '',
                fileType,
                originalName,
                localUri,
                loading: false,
                isInvoice: metadataInvoice ?? copy[idx]?.isInvoice ?? isInvoice,
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
  }, [filesJson, getFile, getFileMetadata, parseFileDescriptors]);

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
        isInvoice: false,
      };
      setAttachedFiles(prev => {
        const newArr = [...prev, placeholder];
        syncFilesJson(newArr);
        return newArr;
      });

      const dataUri = await getFile(fileData.id);
      const metadata = await getFileMetadata(fileData.id);
      const fileType = metadata?.file_type ?? '';
      const originalName = metadata?.original_name ?? '';
      const localUri = metadata?.localUri ?? '';

      setAttachedFiles(prev =>
        prev.map(f => {
          const metadataInvoice = (metadata as any)?.is_invoice ?? (metadata as any)?.isInvoice;
          return f.id === fileData.id
            ? {
                id: f.id,
                previewUri: dataUri ?? '',
                fileType,
                originalName,
                localUri,
                loading: false,
                isInvoice: metadataInvoice ?? f.isInvoice ?? false,
              }
            : f;
        })
      );
    } catch (error: any) {
      console.error('Error agregando archivo:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteFile = (id: number) => {
    setAttachedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      syncFilesJson(filtered);
      return filtered;
    });
  };

  const handleToggleInvoice = (id: number) => {
    setAttachedFiles(prev => {
      const updated = prev.map(file =>
        file.id === id ? { ...file, isInvoice: !file.isInvoice } : file
      );
      syncFilesJson(updated);
      return updated;
    });
  };

  let previewModal = null;
  if (pdfPreviewUri) {
    previewModal = (
      <PdfPreviewModal uri={pdfPreviewUri} onClose={() => setPdfPreviewUri(null)} />
    );
  } else if (previewIndex !== null) {
    const current = attachedFiles[previewIndex];
    const lowerType = current.fileType.toLowerCase();
    const isImage = lowerType.includes('image');
    const isVideo = lowerType.includes('video');

    if (isImage) {
      const imageFiles = attachedFiles.filter(f => f.fileType.toLowerCase().includes('image'));
      const imageIndex = imageFiles.findIndex(f => f.id === current.id);
      previewModal = (
        <ImagePreviewModal
          images={imageFiles}
          initialIndex={imageIndex}
          onClose={() => setPreviewIndex(null)}
        />
      );
    } else if (isVideo) {
      previewModal = (
        <VideoPreviewModal uri={current.previewUri} onClose={() => setPreviewIndex(null)} />
      );
    }
  }

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
            onPreviewPdf={handlePreviewPdf}
            editable={isEditable}
            showInvoiceToggle={invoiceMarkingEnabled}
            onToggleInvoice={handleToggleInvoice}
          />
        ))}
        {isEditable && (
          <TouchableOpacity style={[styles.fileItem, styles.addFileItem]} onPress={handleSelectSource}>
            <Text style={styles.addButtonText}>Add File</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {previewModal}
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
  previewContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  invoicePreview: {
    borderWidth: 3,
    borderColor: '#2e7d32',
  },
  loadingContainer: {
    backgroundColor: '#ddd',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  invoiceOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: '#2e7d32',
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
  invoiceToggle: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
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
  pdfThumbnailWrapper: {
    width: '100%',
    height: '100%',
  },
  pdfPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pdfPlaceholderTitle: {
    marginTop: 8,
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pdfPlaceholderHint: {
    marginTop: 8,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
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
  pdfLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pdfWebContainer: {
    backgroundColor: '#fff',
  },
  invoiceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#2e7d32',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  invoiceBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
});
