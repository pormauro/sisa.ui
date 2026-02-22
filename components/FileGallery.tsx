import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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

  const isImageFile = (file: FileRecord) => getMime(file).includes('image');
  const isVideoFile = (file: FileRecord) => getMime(file).includes('video');

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
          onPress={() => openFile(item)}
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
});

export { FileGallery };
export default FileGallery;
