// app/folders/FolderModal.js
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CircleImagePicker from '../../../src/components/CircleImagePicker';

export default function FolderModal({ visible, onClose, onSubmit, folder }) {
  const [folderName, setFolderName] = useState('');
  const [folderImageId, setFolderImageId] = useState(null);

  useEffect(() => {
    if (folder) {
      setFolderName(folder.name);
      setFolderImageId(folder.image || null);
    } else {
      setFolderName('');
      setFolderImageId(null);
    }
  }, [folder]);

  const handleSubmit = () => {
    if (folderName.trim() === '') {
      Alert.alert("Error", "El nombre de la carpeta es obligatorio");
      return;
    }
    // Enviar el payload con el campo 'folder_image_file_id' en lugar de 'image'
    onSubmit({ name: folderName, folder_image_file_id: folderImageId });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{folder ? 'Edit Folder' : 'Add Folder'}</Text>
          {/* Integración del CircleImagePicker para seleccionar la imagen de la carpeta */}
          <CircleImagePicker
            fileId={folderImageId}
            editable={true}
            size={80}
            onImageChange={(newFileId) => setFolderImageId(newFileId)}
          />
          <TextInput
            placeholder="Folder Name"
            value={folderName}
            onChangeText={setFolderName}
            style={styles.input}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={[styles.button, styles.submitButton]}>
              <Text style={styles.buttonText}>{folder ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:'center',
    alignItems:'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 15,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection:'row',
    justifyContent:'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#007BFF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
