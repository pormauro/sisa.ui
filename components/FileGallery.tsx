import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useFiles, FileRecord } from '@/contexts/FilesContext';

type FileGalleryProps = {
  entityType: string;
  entityId: number;
  filesJson?: string | number[] | { id: number }[] | null;
};

const parseAttachedFiles = (
  raw: FileGalleryProps['filesJson'],
): number[] => {
  if (!raw) return [];

  const normalizeArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => {
        if (typeof item === 'number') {
          return item;
        }
        if (typeof item === 'string') {
          const parsed = Number(item);
          return Number.isFinite(parsed) ? parsed : null;
        }
        if (item && typeof item === 'object' && 'id' in item) {
          const parsed = Number((item as any).id);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })
      .filter((value): value is number => Number.isFinite(value ?? NaN));
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

const FileGallery: React.FC<FileGalleryProps> = ({ entityType, entityId, filesJson }) => {
  const { getFilesForEntity, ensureFilesDownloadedForEntity, openFile, registerEntityFiles } = useFiles();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileIds = useMemo(() => parseAttachedFiles(filesJson), [filesJson]);

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
    } catch (error) {
      Alert.alert('Error', 'El archivo no está disponible para abrir');
    }
  };

  const renderItem = ({ item }: { item: FileRecord }) => {
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ThemedText>Cargando archivos...</ThemedText>
      ) : (
        <FlatList
          data={files}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          scrollEnabled={false}
        />
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
    marginBottom: 12,
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
});

export { FileGallery };
export default FileGallery;
