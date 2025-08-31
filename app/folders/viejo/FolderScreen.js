// src/screens/FolderScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Text, View } from 'react-native';
import FolderTreeResource from '../../../src/services/FolderTreeResource';

export default function FolderScreen() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga el árbol completo al montar el componente
  const loadTree = async () => {
    setLoading(true);
    try {
      const folderTree = await FolderTreeResource.load();
      setTree(folderTree);
    } catch (error) {
      console.error('Error loading folder tree:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  // Ejemplo de función para agregar una nueva carpeta
  const handleAddFolder = async () => {
    try {
      // Supongamos que queremos agregar "Nueva Carpeta" debajo del cliente con id '1'
      const newFolder = await FolderTreeResource.addFolder(
        { name: 'Nueva Carpeta', folder_image_file_id: null },
        '1'
      );
      console.log('Carpeta agregada:', newFolder);
      // Actualizamos el estado con el árbol actualizado
      setTree([...FolderTreeResource.getTree()]);
    } catch (error) {
      console.error('Error adding folder:', error);
    }
  };

  // Ejemplo de renderizado: mostramos el árbol como JSON (para propósitos de prueba)
  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" />
      ) : (
        <View>
          <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Árbol de Carpetas:</Text>
          <Text style={{ fontFamily: 'monospace' }}>{JSON.stringify(tree, null, 2)}</Text>
          <Button title="Agregar Carpeta" onPress={handleAddFolder} />
        </View>
      )}
    </ScrollView>
  );
}
