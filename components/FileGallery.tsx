// components/FileGallery.tsx

import React, { useEffect, useState, useContext } from 'react';
import {
  View,
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

const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const FileGallery: React.FC<FileGalleryProps> = ({ filesJson, onChangeFilesJson }) => {
  const { getFile } = useContext(FileContext);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AttachedFile | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const ids: number[] = filesJson ? JSON.parse(filesJson) : [];
        const fetched: AttachedFile[] = [];

        for (const id of ids) {
          const fileResult = await getFile(id);
          if (fileResult) {
            const dataUri = await blobToDataURL(fileResult.blob);
            fetched.push({
              id,
              previewUri: dataUri,
              fileType: fileResult.metadata.file_type,
              originalName: fileResult.metadata.original_name,
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
  }, [filesJson]);

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
