import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useFiles, FileRecord } from '@/contexts/FilesContext';

type FileGalleryProps = {
  entityType: string;
  entityId: number;
};

const FileGallery: React.FC<FileGalleryProps> = ({ entityType, entityId }) => {
  const { getFilesForEntity, ensureFilesDownloadedForEntity, openFile } = useFiles();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      const filesForEntity = await getFilesForEntity(entityType, entityId);
      setFiles(filesForEntity);
      setIsLoading(false);
    };

    fetchFiles();
  }, [entityType, entityId, getFilesForEntity]);

  useEffect(() => {
    const downloadFiles = async () => {
      await ensureFilesDownloadedForEntity(entityType, entityId);
    };

    downloadFiles();
  }, [entityType, entityId, ensureFilesDownloadedForEntity]);

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
        <FlatList data={files} keyExtractor={item => item.id.toString()} renderItem={renderItem} />
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
