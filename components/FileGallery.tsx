import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
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
        if (typeof item === 'string') {
          const parsed = Number(item);
          return Number.isFinite(parsed) ? { id: parsed, isInvoice: false } : null;
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
  const { getFilesForEntity, ensureFilesDownloadedForEntity, openFile, registerEntityFiles, uploadFile } = useFiles();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const parsedFiles = useMemo(() => parseAttachedFiles(filesJson), [filesJson]);
  const fileIds = useMemo(() => parsedFiles.map(file => file.id), [parsedFiles]);
  const invoiceMap = useMemo(() => new Map(parsedFiles.map(file => [file.id, file.isInvoice])), [parsedFiles]);

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
  }, [entityType, entityId, fileIds, getFilesForEntity, registerEntityFiles]);

  useEffect(() => {
    const downloadFiles = async () => {
      await ensureFilesDownloadedForEntity(entityType, entityId);
      const refreshed = await getFilesForEntity(entityType, entityId);
      setFiles(refreshed);
    };

    downloadFiles();
  }, [entityType, entityId, ensureFilesDownloadedForEntity, getFilesForEntity, fileIds]);

  const handleOpenFile = async (file: FileRecord) => {
    try {
      await openFile(file);
    } catch {
      Alert.alert('Error', 'El archivo no está disponible para abrir');
    }
  };

  const handleAddFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const picked = result.assets[0];
    const uploaded = await uploadFile(
      picked.uri,
      picked.name ?? `archivo_${Date.now()}`,
      picked.mimeType ?? 'application/octet-stream',
      picked.size ?? 0,
    );

    if (!uploaded) {
      return;
    }

    const updatedIds = Array.from(new Set([...fileIds, uploaded.id]));
    const updatedInvoiceMap = new Map(invoiceMap);
    updatedInvoiceMap.set(uploaded.id, false);
    syncFilesJson(updatedIds, updatedInvoiceMap);
  };

  const handleDeleteFile = (fileId: number) => {
    const updatedIds = fileIds.filter(id => id !== fileId);
    const updatedInvoiceMap = new Map(invoiceMap);
    updatedInvoiceMap.delete(fileId);
    syncFilesJson(updatedIds, updatedInvoiceMap);
  };

  const handleToggleInvoice = (fileId: number) => {
    const updatedInvoiceMap = new Map(invoiceMap);
    const current = Boolean(updatedInvoiceMap.get(fileId));
    updatedInvoiceMap.set(fileId, !current);
    syncFilesJson(fileIds, updatedInvoiceMap);
  };

  const renderItem = (item: FileRecord) => {
    const isDownloaded = item.downloaded === 1;

    return (
      <TouchableOpacity
        style={[styles.fileItem, { opacity: isDownloaded ? 1 : 0.5 }]}
        onPress={() => handleOpenFile(item)}
        disabled={!isDownloaded}
      >
        <ThemedText style={styles.fileName}>{item.name}</ThemedText>
        <ThemedText style={styles.fileStatus}>
          {isDownloaded ? 'Disponible offline' : 'Pendiente de descarga'}
        </ThemedText>
        {invoiceMarkingEnabled && (
          <TouchableOpacity style={styles.invoiceButton} onPress={() => handleToggleInvoice(item.id)}>
            <ThemedText>{invoiceMap.get(item.id) ? '✅ Factura' : '☑️ Marcar factura'}</ThemedText>
          </TouchableOpacity>
        )}
        {editable && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteFile(item.id)}>
            <ThemedText style={styles.deleteText}>Eliminar</ThemedText>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ThemedText>Cargando archivos...</ThemedText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {files.map(file => (
            <View key={file.id.toString()}>
              {renderItem(file)}
            </View>
          ))}
          {editable && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddFile}>
              <ThemedText style={styles.addText}>Add File</ThemedText>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  fileItem: {
    width: 220,
    marginBottom: 12,
    marginRight: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fileStatus: {
    fontSize: 14,
    color: '#888',
  },
  addButton: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  addText: {
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: 8,
  },
  deleteText: {
    color: '#dc3545',
    fontWeight: '600',
  },
  invoiceButton: {
    marginTop: 8,
  },
});

export { FileGallery };
export default FileGallery;
