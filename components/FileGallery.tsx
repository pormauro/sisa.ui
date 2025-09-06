// components/FileGallery.tsx

import React, { useEffect, useState, useContext } from 'react';
import {
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { FileContext } from '@/contexts/FilesContext';
import FilePreviewModal from './FilePreviewModal';

interface FileGalleryProps {
  filesJson: string;
  onChangeFilesJson: (json: string) => void;
}

interface AttachedFile {
  id: number;
  previewUri: string;
  fileType: string;
  originalName: string;
}

const FileGallery: React.FC<FileGalleryProps> = ({ filesJson, onChangeFilesJson }) => {
  const { getFile, getFileMetadata } = useContext(FileContext);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AttachedFile | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const ids: number[] = filesJson ? JSON.parse(filesJson) : [];
        const fetched: AttachedFile[] = [];

        for (const id of ids) {
          const [fileUri, metadata] = await Promise.all([
            getFile(id),
            getFileMetadata(id),
          ]);
          if (fileUri && metadata) {
            fetched.push({
              id,
              previewUri: fileUri,
              fileType: metadata.file_type,
              originalName: metadata.original_name,
            });
          }
        }

        setFiles(fetched);
      } catch (err) {
        Alert.alert('Error', 'No se pudieron cargar los archivos.');
        console.error(err);
      }
    };

    fetchFiles();
  }, [filesJson, getFile, getFileMetadata]);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {files.map((file) => (
          <TouchableOpacity
            key={file.id.toString()}
            style={styles.previewBox}
            onPress={() => setSelectedFile(file)}
          >
            {file.fileType.startsWith('image/') ? (
              <Image source={{ uri: file.previewUri }} style={styles.previewImage} />
            ) : file.fileType.startsWith('video/') ? (
              <Text style={styles.label}>🎥 Video</Text>
            ) : (
              <Text style={styles.label}>
                📄 {file.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FilePreviewModal
        visible={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        file={selectedFile}
      />
    </>
  );
};

export default FileGallery;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  previewBox: {
    width: 120,
    height: 120,
    marginRight: 12,
    backgroundColor: '#ddd',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  label: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 5,
  },
});
