import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  Image,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ResizeMode, Video } from 'expo-av';
import { ThemedText } from './ThemedText';
import { useFiles, FileRecord } from '@/contexts/FilesContext';

type AttachedFileValue = number | { id: number; is_invoice?: boolean };

type FileGalleryProps = {
  entityType: string;
  entityId: number;
  filesJson?: string | AttachedFileValue[] | null;
  onChangeFilesJson?: (value: string) => void;
  editable?: boolean;
  invoiceMarkingEnabled?: boolean;
};

const parseAttachedFiles = (
  raw: FileGalleryProps['filesJson'],
): { id: number; isInvoice: boolean }[] => {
  if (!raw) return [];

  const normalizeArray = (value: unknown): { id: number; isInvoice: boolean }[] => {
    if (!Array.isArray(value)) return [];

    return value
      .map(item => {
        if (typeof item === 'number') {
          return { id: item, isInvoice: false };
        }
        if (item && typeof item === 'object' && 'id' in item) {
          const parsed = Number((item as any).id);
          const isInvoice = Boolean((item as any).is_invoice);
          return Number.isFinite(parsed) ? { id: parsed, isInvoice } : null;
        }
        return null;
      })
      .filter((value): value is { id: number; isInvoice: boolean } => Boolean(value));
  };

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeArray(parsed);
    } catch {
      return [];
    }
  }

  return normalizeArray(raw);
};

const FileGallery: React.FC<FileGalleryProps> = ({
  entityType,
  entityId,
  filesJson,
  onChangeFilesJson,
  editable = false,
  invoiceMarkingEnabled = false,
}) => {
  const {
    getFilesForEntity,
    ensureFilesDownloadedForEntity,
    openFile,
    registerEntityFiles,
    uploadFile,
  } = useFiles();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerAreaSize, setViewerAreaSize] = useState({ width: 0, height: 0 });

  const gestureStartZoomRef = useRef(1);
  const gestureStartOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const panStartPointRef = useRef({ x: 0, y: 0 });
  const lastTouchCountRef = useRef(0);

  const parsedFiles = useMemo(() => parseAttachedFiles(filesJson), [filesJson]);
  const fileIds = useMemo(() => parsedFiles.map(file => file.id), [parsedFiles]);
  const invoiceMap = useMemo(
    () => new Map(parsedFiles.map(file => [file.id, file.isInvoice])),
    [parsedFiles],
  );

  const syncFilesJson = (ids: number[], invoiceById: Map<number, boolean>) => {
    if (!onChangeFilesJson) return;

    const payload = invoiceMarkingEnabled
      ? ids.map(id => ({ id, is_invoice: Boolean(invoiceById.get(id)) }))
      : ids;

    onChangeFilesJson(JSON.stringify(payload));
  };

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      await registerEntityFiles(entityType, entityId, fileIds);
      const filesForEntity = await getFilesForEntity(entityType, entityId);
      setFiles(filesForEntity);
      setIsLoading(false);
    };
    fetchFiles();
  }, [entityType, entityId, fileIds]);

  useEffect(() => {
    const downloadFiles = async () => {
      await ensureFilesDownloadedForEntity(entityType, entityId);
      const refreshed = await getFilesForEntity(entityType, entityId);
      setFiles(refreshed);
    };
    downloadFiles();
  }, [entityType, entityId, fileIds]);

  const handleUpload = async (uri: string, name: string, mime: string, size: number) => {
    const uploaded = await uploadFile(uri, name, mime, size);
    if (!uploaded) return;

    const updatedIds = Array.from(new Set([...fileIds, uploaded.id]));
    const updatedInvoiceMap = new Map(invoiceMap);
    updatedInvoiceMap.set(uploaded.id, false);
    syncFilesJson(updatedIds, updatedInvoiceMap);
  };

  const removeFile = (id: number) => {
    Alert.alert('Eliminar archivo', '¿Seguro que querés quitarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const newIds = fileIds.filter(f => f !== id);
          const newMap = new Map(invoiceMap);
          newMap.delete(id);
          syncFilesJson(newIds, newMap);
        },
      },
    ]);
  };

  const handlePickDocument = async () => {
    setActionMenuVisible(false);

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    await handleUpload(
      file.uri,
      file.name ?? `archivo_${Date.now()}`,
      file.mimeType ?? 'application/octet-stream',
      file.size ?? 0,
    );
  };

  const handleTakePhoto = async () => {
    setActionMenuVisible(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const photo = result.assets[0];
    await handleUpload(
      photo.uri,
      `photo_${Date.now()}.jpg`,
      photo.mimeType ?? 'image/jpeg',
      photo.fileSize ?? 0,
    );
  };

  const handleRecordVideo = async () => {
    setActionMenuVisible(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const video = result.assets[0];
    await handleUpload(
      video.uri,
      `video_${Date.now()}.mp4`,
      video.mimeType ?? 'video/mp4',
      video.fileSize ?? 0,
    );
  };

  const getMime = (file: FileRecord) =>
    String(file.mimeType || file.mime || file.file_type || '').toLowerCase();

  const getExtension = (file: FileRecord) => {
    const candidates = [file.name, file.localUri, file.remoteUrl]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());

    for (const value of candidates) {
      const cleanValue = value.split('?')[0].split('#')[0];
      const extension = cleanValue.split('.').pop();
      if (extension && extension !== cleanValue) {
        return extension;
      }
    }

    return '';
  };

  const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);
  const videoExtensions = new Set(['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', '3gp', 'mpeg', 'mpg']);

  const isImageFile = (file: FileRecord) => {
    const mime = getMime(file);
    if (mime.includes('image')) return true;
    return imageExtensions.has(getExtension(file));
  };

  const isVideoFile = (file: FileRecord) => {
    const mime = getMime(file);
    if (mime.includes('video')) return true;
    return videoExtensions.has(getExtension(file));
  };

  const mediaFiles = files.filter(
    file => file.downloaded === 1 && (isImageFile(file) || isVideoFile(file)),
  );

  const activeMedia = mediaFiles[viewerIndex];

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  const getMaxOffsets = (zoom: number) => ({
    maxX: ((zoom - 1) * viewerAreaSize.width) / 2,
    maxY: ((zoom - 1) * viewerAreaSize.height) / 2,
  });

  const clampOffset = (offset: { x: number; y: number }, zoom: number) => {
    if (zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const { maxX, maxY } = getMaxOffsets(zoom);

    return {
      x: clamp(offset.x, -maxX, maxX),
      y: clamp(offset.y, -maxY, maxY),
    };
  };

  const getTouchDistance = (touches: readonly { pageX: number; pageY: number }[]) => {
    if (touches.length < 2) return 0;

    const [first, second] = touches;
    return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
  };

  const resetViewerTransform = () => {
    setViewerZoom(1);
    setViewerOffset({ x: 0, y: 0 });
    gestureStartZoomRef.current = 1;
    gestureStartOffsetRef.current = { x: 0, y: 0 };
    pinchStartDistanceRef.current = null;
    panStartPointRef.current = { x: 0, y: 0 };
    lastTouchCountRef.current = 0;
  };

  const openMediaViewer = (file: FileRecord) => {
    const mediaIndex = mediaFiles.findIndex(media => media.id === file.id);
    if (mediaIndex < 0) return;
    resetViewerTransform();
    setViewerIndex(mediaIndex);
    setViewerVisible(true);
  };

  const closeMediaViewer = () => {
    setViewerVisible(false);
    resetViewerTransform();
  };

  const goToPreviousMedia = () => {
    if (!mediaFiles.length) return;
    resetViewerTransform();
    setViewerIndex(current => (current === 0 ? mediaFiles.length - 1 : current - 1));
  };

  const goToNextMedia = () => {
    if (!mediaFiles.length) return;
    resetViewerTransform();
    setViewerIndex(current => (current === mediaFiles.length - 1 ? 0 : current + 1));
  };

  const handleImageGestureStart = (event: any) => {
    const touches = event.nativeEvent.touches as { pageX: number; pageY: number }[];
    const touchCount = touches.length;

    lastTouchCountRef.current = touchCount;

    if (touchCount >= 2) {
      const distance = getTouchDistance(touches);
      pinchStartDistanceRef.current = distance > 0 ? distance : null;
      gestureStartZoomRef.current = viewerZoom;
      gestureStartOffsetRef.current = viewerOffset;
      return;
    }

    if (touchCount === 1) {
      panStartPointRef.current = { x: touches[0].pageX, y: touches[0].pageY };
      gestureStartOffsetRef.current = viewerOffset;
      pinchStartDistanceRef.current = null;
    }
  };

  const handleImageGestureMove = (event: any) => {
    const touches = event.nativeEvent.touches as { pageX: number; pageY: number }[];
    const touchCount = touches.length;

    if (touchCount >= 2) {
      const distance = getTouchDistance(touches);

      if (!pinchStartDistanceRef.current || lastTouchCountRef.current < 2) {
        pinchStartDistanceRef.current = distance > 0 ? distance : null;
        gestureStartZoomRef.current = viewerZoom;
        gestureStartOffsetRef.current = viewerOffset;
      }

      if (!pinchStartDistanceRef.current) return;

      const rawZoom = gestureStartZoomRef.current * (distance / pinchStartDistanceRef.current);
      const nextZoom = clamp(Number(rawZoom.toFixed(3)), 1, 3);
      const nextOffset = clampOffset(gestureStartOffsetRef.current, nextZoom);

      setViewerZoom(nextZoom);
      setViewerOffset(nextOffset);
      lastTouchCountRef.current = touchCount;
      return;
    }

    if (touchCount === 1 && viewerZoom > 1) {
      const currentTouch = touches[0];

      if (lastTouchCountRef.current !== 1) {
        panStartPointRef.current = { x: currentTouch.pageX, y: currentTouch.pageY };
        gestureStartOffsetRef.current = viewerOffset;
      }

      const deltaX = currentTouch.pageX - panStartPointRef.current.x;
      const deltaY = currentTouch.pageY - panStartPointRef.current.y;

      const nextOffset = clampOffset(
        {
          x: gestureStartOffsetRef.current.x + deltaX,
          y: gestureStartOffsetRef.current.y + deltaY,
        },
        viewerZoom,
      );

      setViewerOffset(nextOffset);
    }

    lastTouchCountRef.current = touchCount;
  };

  const handleImageGestureEnd = () => {
    lastTouchCountRef.current = 0;
    pinchStartDistanceRef.current = null;
    gestureStartZoomRef.current = viewerZoom;
    gestureStartOffsetRef.current = viewerOffset;

    if (viewerZoom <= 1) {
      setViewerZoom(1);
      setViewerOffset({ x: 0, y: 0 });
    } else {
      setViewerOffset(current => clampOffset(current, viewerZoom));
    }
  };

  const handleFilePress = (file: FileRecord) => {
    if (isImageFile(file) || isVideoFile(file)) {
      openMediaViewer(file);
      return;
    }

    openFile(file);
  };

  const renderPreview = (file: FileRecord) => {
    const uri = file.localUri;
    const downloaded = file.downloaded === 1 && Boolean(uri);

    if (isImageFile(file)) {
      // Si no está descargado, evitamos intentar renderizar una URI inexistente.
      if (!downloaded) {
        return (
          <View style={[styles.preview, styles.placeholder]}>
            <MaterialIcons name="image" size={34} color="#CFCFCF" />
          </View>
        );
      }

      return <Image source={{ uri }} style={styles.preview} />;
    }

    if (isVideoFile(file)) {
      // Requisito: sin previsualización. Solo placeholder + icono de play.
      return (
        <View style={[styles.preview, styles.videoPlaceholder, !downloaded && styles.notReady]}>
          <MaterialIcons name="play-circle-outline" size={44} color="#FFFFFF" />
        </View>
      );
    }

    return (
      <View style={[styles.preview, styles.placeholder, !downloaded && styles.notReady]}>
        <ThemedText style={styles.fileIcon}>📁</ThemedText>
      </View>
    );
  };

  const renderItem = (item: FileRecord) => {
    const isDownloaded = item.downloaded === 1;

    return (
      <View style={styles.fileCardWrapper}>
        <TouchableOpacity
          style={[styles.fileCard, { opacity: isDownloaded ? 1 : 0.5 }]}
          onPress={() => handleFilePress(item)}
          disabled={!isDownloaded}
        >
          {renderPreview(item)}

          <ThemedText numberOfLines={1} style={styles.fileName}>
            {item.name}
          </ThemedText>

          {!isDownloaded && <ThemedText style={styles.fileStatus}>No disponible offline</ThemedText>}

          {invoiceMarkingEnabled && (
            <TouchableOpacity
              onPress={() => {
                const updated = new Map(invoiceMap);
                updated.set(item.id, !invoiceMap.get(item.id));
                syncFilesJson(fileIds, updated);
              }}
            >
              <ThemedText>{invoiceMap.get(item.id) ? '💰 Factura' : 'Marcar factura'}</ThemedText>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {editable && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => removeFile(item.id)}>
            <MaterialIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ThemedText>Cargando archivos...</ThemedText>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {files.map(file => (
              <View key={file.id.toString()}>{renderItem(file)}</View>
            ))}

            {editable && (
              <TouchableOpacity style={styles.addButton} onPress={() => setActionMenuVisible(true)}>
                <ThemedText style={styles.addText}>＋</ThemedText>
              </TouchableOpacity>
            )}
          </ScrollView>

          <Modal transparent visible={actionMenuVisible} animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity onPress={handlePickDocument}>
                  <ThemedText style={styles.modalOption}>📁 Elegir archivo</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleTakePhoto}>
                  <ThemedText style={styles.modalOption}>📷 Sacar foto</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRecordVideo}>
                  <ThemedText style={styles.modalOption}>🎥 Grabar video</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActionMenuVisible(false)}>
                  <ThemedText style={styles.modalCancel}>Cancelar</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={viewerVisible} animationType="fade" transparent statusBarTranslucent>
            <View style={styles.viewerOverlay}>
              <Pressable style={styles.viewerCloseButton} onPress={closeMediaViewer}>
                <MaterialIcons name="close" size={30} color="#fff" />
              </Pressable>

              {activeMedia ? (
                <>
                  <View style={styles.viewerContent}>
                    {isImageFile(activeMedia) ? (
                      <View
                        style={styles.viewerImageGestureArea}
                        onLayout={event => {
                          const { width, height } = event.nativeEvent.layout;
                          setViewerAreaSize({ width, height });
                        }}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={handleImageGestureStart}
                        onResponderMove={handleImageGestureMove}
                        onResponderRelease={handleImageGestureEnd}
                        onResponderTerminate={handleImageGestureEnd}
                      >
                        <Image
                          source={{ uri: activeMedia.localUri! }}
                          style={[
                            styles.viewerMedia,
                            {
                              transform: [
                                { translateX: viewerOffset.x },
                                { translateY: viewerOffset.y },
                                { scale: viewerZoom },
                              ],
                            },
                          ]}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <Video
                        source={{ uri: activeMedia.localUri! }}
                        style={styles.viewerMedia}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        isLooping
                      />
                    )}
                  </View>

                  <View style={styles.viewerNavigation}>
                    <Pressable style={styles.arrowButton} onPress={goToPreviousMedia}>
                      <MaterialIcons name="chevron-left" size={36} color="#fff" />
                    </Pressable>

                    <ThemedText style={styles.viewerCounter}>
                      {viewerIndex + 1} / {mediaFiles.length}
                    </ThemedText>

                    <Pressable style={styles.arrowButton} onPress={goToNextMedia}>
                      <MaterialIcons name="chevron-right" size={36} color="#fff" />
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },

  fileCard: {
    width: 180,
    height: 190,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'space-between',
  },

  fileCardWrapper: {
    position: 'relative',
    marginRight: 12,
  },

  preview: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: '#000',
  },

  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  notReady: {
    opacity: 0.7,
  },

  fileIcon: {
    fontSize: 36,
    textAlign: 'center',
  },

  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },

  fileStatus: {
    fontSize: 12,
    color: '#f6ad55',
  },

  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff55',
  },

  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addText: {
    fontSize: 28,
    fontWeight: 'bold',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: 260,
    backgroundColor: '#1e1e1e',
    padding: 20,
    borderRadius: 12,
  },

  modalOption: {
    fontSize: 16,
    marginBottom: 16,
  },

  modalCancel: {
    textAlign: 'center',
    color: '#dc3545',
    marginTop: 10,
  },

  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  viewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  viewerContent: {
    width: '100%',
    height: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewerMedia: {
    width: '100%',
    height: '100%',
  },

  viewerImageGestureArea: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },

  viewerNavigation: {
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  arrowButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  viewerCounter: {
    fontSize: 16,
    fontWeight: '700',
  },

});

export { FileGallery };
export default FileGallery;
