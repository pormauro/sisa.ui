// src/screens/FolderExplorerWindows.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import FolderTreeResource from '../../src/services/FolderTreeResource';

export default function FolderExplorerWindows() {
  const [tree, setTree] = useState([]);               // Árbol completo
  const [selectedNode, setSelectedNode] = useState(null); // Nodo seleccionado (para el contenido derecho)
  const [loading, setLoading] = useState(true);

  // Cargar el árbol completo desde el recurso y definir el nodo inicial
  const loadTree = async () => {
    setLoading(true);
    try {
      await FolderTreeResource.load();
      const treeData = FolderTreeResource.getTree();
      setTree(treeData);
      // Si existen clientes, inicializamos con el primer cliente
      if (treeData.length > 0) {
        setSelectedNode(treeData[0]);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  // Renderizado recursivo para el panel lateral (sidebar)
  const renderTreeNode = (node, depth = 0) => {
    return (
      <View key={node.id}>
        <TouchableOpacity
          style={[
            styles.treeNode,
            { marginLeft: depth * 15 },
            selectedNode && selectedNode.id === node.id && styles.selectedTreeNode,
          ]}
          onPress={() => setSelectedNode(node)}
        >
          <Text style={styles.treeNodeText}>
            {node.name} {node.type === 'client' ? '(Cliente)' : ''}
          </Text>
        </TouchableOpacity>
        {node.children && node.children.length > 0 &&
          node.children.map(child => renderTreeNode(child, depth + 1))}
      </View>
    );
  };

  // Helper: calcula la ruta (breadcrumb) desde la raíz hasta el nodo seleccionado
  const getBreadcrumbPath = (target, nodes, path = []) => {
    for (let node of nodes) {
      const newPath = [...path, node];
      if (node.id === target.id) return newPath;
      if (node.children && node.children.length > 0) {
        const result = getBreadcrumbPath(target, node.children, newPath);
        if (result) return result;
      }
    }
    return null;
  };

  const breadcrumb = selectedNode ? getBreadcrumbPath(selectedNode, tree) : [];

  // Panel derecho: muestra los hijos del nodo seleccionado
  const renderContentItem = (item) => {
    return (
      <View key={item.id} style={styles.contentItem}>
        <Text style={styles.contentItemText}>
          {item.name} {item.type === 'client' ? '(Cliente)' : ''}
        </Text>
        {item.type === 'folder' && (
          <View style={styles.contentActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditFolder(item)}
            >
              <Text style={styles.actionButtonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteFolder(item)}
            >
              <Text style={styles.actionButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Operaciones: agregar, editar y eliminar carpetas (solo para nodos de tipo "folder")
  const handleAddFolder = async () => {
    if (!selectedNode) return;
    // Aquí podrías usar un modal para solicitar el nombre; en este ejemplo se usa un valor fijo.
    const folderName = 'Nueva Carpeta';
    try {
      // Se agrega debajo del nodo seleccionado
      const parentId = selectedNode.id;
      await FolderTreeResource.addFolder({ name: folderName, folder_image_file_id: null }, parentId);
      await loadTree();
      Alert.alert("Éxito", "Carpeta agregada");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleEditFolder = async (node) => {
    if (node.type !== 'folder') return;
    // Para el ejemplo usamos un nuevo nombre fijo; en una app real usarías un formulario/modal
    const newName = 'Carpeta Editada';
    try {
      await FolderTreeResource.updateFolder(node.id, { name: newName, folder_image_file_id: node.fileId });
      await loadTree();
      Alert.alert("Éxito", "Carpeta actualizada");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDeleteFolder = async (node) => {
    if (node.type !== 'folder') return;
    Alert.alert(
      "Confirmar",
      `¿Estás seguro de eliminar la carpeta "${node.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await FolderTreeResource.deleteFolder(node.id);
              await loadTree();
              Alert.alert("Éxito", "Carpeta eliminada");
              // Si se eliminó el nodo seleccionado, reinicia la selección al primer nodo de la raíz
              if (selectedNode.id === node.id) {
                setSelectedNode(tree[0] || null);
              }
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Panel lateral: árbol completo */}
      <View style={styles.sidebar}>
        <ScrollView>{tree.map(node => renderTreeNode(node))}</ScrollView>
      </View>
      {/* Panel derecho: contenido del nodo seleccionado */}
      <View style={styles.contentArea}>
        {/* Breadcrumb para navegación */}
        <View style={styles.breadcrumbContainer}>
          {breadcrumb &&
            breadcrumb.map((node, index) => (
              <TouchableOpacity key={node.id} onPress={() => setSelectedNode(node)}>
                <Text style={styles.breadcrumbText}>
                  {node.name}{index < breadcrumb.length - 1 ? ' > ' : ''}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
        <ScrollView style={styles.contentList}>
          {selectedNode && selectedNode.children && selectedNode.children.length > 0 ? (
            selectedNode.children.map(child => renderContentItem(child))
          ) : (
            <Text style={styles.noContentText}>No hay elementos en este nivel.</Text>
          )}
        </ScrollView>
        {/* Acciones en el panel derecho */}
        <View style={styles.footer}>
          {selectedNode && selectedNode.type !== 'client' && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddFolder}>
              <Text style={styles.addButtonText}>+ Agregar Carpeta</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250,
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  contentArea: { flex: 1, padding: 10 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  treeNode: { paddingVertical: 8, paddingHorizontal: 5 },
  selectedTreeNode: { backgroundColor: '#cce5ff' },
  treeNodeText: { fontSize: 16 },
  breadcrumbContainer: { flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' },
  breadcrumbText: { fontSize: 16, color: '#007BFF' },
  contentList: { flex: 1 },
  contentItem: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
  },
  contentItemText: { fontSize: 16 },
  contentActions: { flexDirection: 'row', marginTop: 5 },
  actionButton: { padding: 5, backgroundColor: '#007BFF', borderRadius: 5, marginRight: 5 },
  deleteButton: { backgroundColor: '#FF3333' },
  actionButtonText: { color: '#fff', fontSize: 14 },
  footer: { marginTop: 10, alignItems: 'center' },
  addButton: { backgroundColor: '#007BFF', padding: 10, borderRadius: 8 },
  addButtonText: { color: '#fff', fontSize: 16 },
  noContentText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
