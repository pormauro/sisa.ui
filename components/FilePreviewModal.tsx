// FileCarousel.tsx (con modal swipe, indicador de posición y botón de descarga)
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  FlatList,
  Linking,
} from 'react-native';
import Video from 'react-native-video';
import * as DocumentPicker from 'expo-document-picker';
import { FileContext } from '@/contexts/FilesContext';
import ImageViewing from 'react-native-image-viewing';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface FileCarouselProps {
  filesJson: string;
  onChangeFilesJson: (updatedJson: string) => void;
}

interface AttachedFile {
  id: number;
  originalName?: string;
  fileType?: string;
  previewUri: string;
}

interface FileItemProps {
  file: AttachedFile;
  onDelete: (fileId: number) => void;
  onPreview: (index: number) => void;
  index: number;
}

const FileItem: React.FC<FileItemProps> = ({ file, onDelete, onPreview, index }) => {
  const renderFilePreview = () => {
    if (file.fileType) {
      const lowerType = file.fileType.toLowerCase();
      if (lowerType.includes('image')) {
        return <Image source={{ uri: file.previewUri }} style={styles.media} resizeMode="cover" />;
      } else if (lowerType.includes('video')) {
        return <Video source={{ uri: file.previewUri }} style={styles.media} resizeMode="cover" paused />;
      }
    }
    return (
      <View style={[styles.media, styles.defaultIcon]}>
        <Text style={styles.iconText}>{file.originalName || 'FILE'}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity style={styles.fileItem} onPress={() => onPreview(index)}>
      {renderFilePreview()}
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(file.id)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const FileCarousel: React.FC<FileCarouselProps> = ({ filesJson, onChangeFilesJson }) => {
  const { uploadFile, getFile } = useContext(FileContext);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const fileIds: number[] = filesJson ? JSON.parse(filesJson) : [];
        const files: AttachedFile[] = [];

        for (const id of fileIds) {
          const dataUri = await getFile(id);
          if (dataUri) {
            files.push({ id, previewUri: dataUri });
          } else {
            console.warn(`Archivo ${id} no encontrado.`);
          }
        }

        setAttachedFiles(files);
      } catch (error) {
        console.error('Error parsing filesJson:', error);
        Alert.alert('Error', 'Formato inválido en filesJson.');
      }
    };

    fetchFiles();
  }, [filesJson, getFile]);

  const pickFile = async (): Promise<{ uri: string; name: string; type: string; size: number } | null> => {
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
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
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
      const pickedFile = await pickFile();
      if (!pickedFile) return;

      if (!pickedFile.uri.startsWith('file://')) {
        Alert.alert('Error', 'El URI del archivo no es válido.');
        return;
      }

      const fileData = await uploadFile(pickedFile.uri, pickedFile.name, pickedFile.type, pickedFile.size);
      if (!fileData) {
        Alert.alert('Error', 'No se pudo subir el archivo.');
        return;
      }

      const previewUri = await getFile(fileData.id);

      const newFile: AttachedFile = {
        id: fileData.id,
        originalName: fileData.original_name,
        fileType: fileData.file_type,
        previewUri: previewUri || '',
      };

      const updatedFiles = [...attachedFiles, newFile];
      setAttachedFiles(updatedFiles);
      onChangeFilesJson(JSON.stringify(updatedFiles.map((file) => file.id)));
    } catch (error: any) {
      console.error('Error agregando archivo:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteFile = (fileId: number) => {
    const updatedFiles = attachedFiles.filter(file => file.id !== fileId);
    setAttachedFiles(updatedFiles);
    onChangeFilesJson(JSON.stringify(updatedFiles.map(file => file.id)));
  };

  const renderPreviewModal = () => {
    if (previewIndex === null) return null;
  
    const isImage = attachedFiles[previewIndex]?.fileType?.toLowerCase().includes('image');
  
    if (isImage) {
      const imageSources = attachedFiles.map(f => ({ uri: f.previewUri }));
  
      return (
        <ImageViewing
          images={imageSources}
          imageIndex={previewIndex}
          visible={true}
          onRequestClose={() => setPreviewIndex(null)}
          FooterComponent={({ imageIndex }) => (
            <View style={styles.modalTopOverlay}>
              <Text style={styles.modalIndex}>{imageIndex + 1} / {attachedFiles.length}</Text>
              {/*<TouchableOpacity
                style={styles.modalDownloadButton}
                onPress={() => Linking.openURL(attachedFiles[imageIndex].previewUri)}
              >
                <Text style={styles.modalDownloadText}>Descargar</Text>
              </TouchableOpacity>*/}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setPreviewIndex(null)}
              >
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }
  
    // Si no es imagen, usamos el modal tradicional
    const renderItem = ({ item }: { item: AttachedFile }) => {
      const lowerType = item.fileType?.toLowerCase() || '';
      const isVideo = lowerType.includes('video');
  
      return (
        <View style={styles.modalContent}>
          {isVideo ? (
            <Video source={{ uri: item.previewUri }} style={styles.fullImage} resizeMode="contain" controls />
          ) : (
            <Text style={styles.fileNameText}>{item.originalName}</Text>
          )}
        </View>
      );
    };
  
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <FlatList
          ref={flatListRef}
          data={attachedFiles}
          horizontal
          pagingEnabled
          initialScrollIndex={previewIndex}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          style={styles.modalOverlay}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setPreviewIndex(index);
          }}
        />
        <View style={styles.modalTopOverlay}>
          <Text style={styles.modalIndex}>{previewIndex + 1} / {attachedFiles.length}</Text>
          <TouchableOpacity
            style={styles.modalDownloadButton}
            onPress={() => Linking.openURL(attachedFiles[previewIndex].previewUri)}
          >
            <Text style={styles.modalDownloadText}>Descargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreviewIndex(null)}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };
  

  return (
    <>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
      >
        {attachedFiles.map((file, index) => (
          <FileItem
            key={file.id.toString()}
            file={file}
            index={index}
            onDelete={handleDeleteFile}
            onPreview={setPreviewIndex}
          />
        ))}
        <TouchableOpacity style={[styles.fileItem, styles.addFileItem]} onPress={handleAddFile}>
          <Text style={styles.addButtonText}>Add File</Text>
        </TouchableOpacity>
      </ScrollView>
      {renderPreviewModal()}
    </>
  );
};

export default FileCarousel;

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
  modalContent: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fileNameText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    padding: 20,
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
  modalDownloadButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalDownloadText: {
    color: '#fff',
    fontSize: 16,
  },
});
