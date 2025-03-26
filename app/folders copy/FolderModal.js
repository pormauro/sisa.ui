// app/folders/FolderModal.js
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function FolderModal({ visible, onClose, onSubmit, folder }) {
  const [folderName, setFolderName] = useState('');
  const [folderImage, setFolderImage] = useState('');

  useEffect(() => {
    if (folder) {
      setFolderName(folder.name);
      setFolderImage(folder.image || '');
    } else {
      setFolderName('');
      setFolderImage('');
    }
  }, [folder]);

  const handleSubmit = () => {
    if (folderName.trim() === '') {
      // Podrías agregar una validación o mostrar un mensaje
      return;
    }
    onSubmit({ name: folderName, image: folderImage ? folderImage.trim() : null });
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
          <Text style={styles.title}>{folder ? 'Editar Carpeta' : 'Agregar Carpeta'}</Text>
          <TextInput 
            placeholder="Nombre de la carpeta"
            value={folderName}
            onChangeText={setFolderName}
            style={styles.input}
          />
          <TextInput 
            placeholder="URL de imagen (opcional)"
            value={folderImage}
            onChangeText={setFolderImage}
            style={styles.input}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={[styles.button, styles.submitButton]}>
              <Text style={styles.buttonText}>{folder ? 'Guardar' : 'Agregar'}</Text>
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
    textAlign: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection:'row',
    justifyContent:'space-between'
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
    fontWeight: 'bold'
  },
});
