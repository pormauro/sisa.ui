// src/screens/FolderExplorerCustom.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import FolderTreeResource from '../../src/services/FolderTreeResource';

export default function FolderExplorerCustom() {
  // Estado del árbol completo y nodo seleccionado
  const [tree, setTree] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null); // Nodo actual en el que se navega
  const [loading, setLoading] = useState(true);
  // Nuevo estado para controlar la visibilidad de la sidebar (menú lateral)
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Carga el árbol completo del recurso
  const loadTree = async () => {
    setLoading(true);
    try {
      await FolderTreeResource.load();
      const treeData = FolderTreeResource.getTree();
      setTree(treeData);
      // Al iniciar, dejamos el nodo seleccionado en null para estar en la raíz (se muestran los clientes)
      setSelectedNode(null);
      setSidebarVisible(true);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  // Ahora se permite agregar carpetas siempre que se tenga un nodo seleccionado (cliente o folder)
  const canAddFolder = selectedNode !== null;
  // La barra lateral se muestra solo si sidebarVisible es true
  const showSidebar = sidebarVisible;

  // Helper para obtener los hijos del nodo seleccionado; si no hay seleccionado, se muestran los nodos raíz (clientes)
  const getCurrentChildren = () => {
    return selectedNode ? (selectedNode.children || []) : tree;
  };

  // Helper recursivo para generar el breadcrumb (ruta) desde la raíz hasta el nodo seleccionado
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

  // Navegar hacia adentro:
  // Si se toca un nodo de tipo folder se establece como nodo seleccionado.
  // Si es cliente, se selecciona y se cierra (oculta) la sidebar.
  const handleNodePress = (node) => {
    if (node.type === 'folder') {
      setSelectedNode(node);
    } else {
      // Al hacer clic en un cliente, se cierra la barra lateral
      setSelectedNode(node);
      setSidebarVisible(false);
    }
  };

  // Función para retroceder un nivel: busca el nodo padre del nodo seleccionado
  const findParent = (nodes, targetId) => {
    for (let node of nodes) {
      if (node.children && node.children.some(child => child.id === targetId)) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findParent(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleBack = () => {
    if (!selectedNode) return;
    const parent = findParent(tree, selectedNode.id);
    setSelectedNode(parent || null);
    // Si volvemos a la raíz (o a un cliente), se puede volver a mostrar la sidebar
    if (!parent || parent.type === 'client') {
      setSidebarVisible(true);
    }
  };

  // Renderizado de cada nodo en la barra lateral (cuando se esté en la raíz o en un cliente)
  const renderSidebarNode = (node, depth = 0) => {
    return (
      <View key={node.id}>
        <TouchableOpacity
          style={[
            styles.sidebarNode,
            { marginLeft: depth * 15 },
            selectedNode && selectedNode.id === node.id && styles.selectedSidebarNode,
          ]}
          onPress={() => setSelectedNode(node)}
        >
          <Text style={styles.sidebarNodeText}>
            {node.name} {node.type === 'client' ? '(Cliente)' : ''}
          </Text>
        </TouchableOpacity>
        {node.children && node.children.length > 0 &&
          node.children.map(child => renderSidebarNode(child, depth + 1))}
      </View>
    );
  };

  // Renderizado de cada elemento en el contenido derecho
  const renderContentItem = (item) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.contentItem}
        onPress={() => handleNodePress(item)}
      >
        <Text style={styles.contentItemText}>
          {item.name} {item.type === 'client' ? '(Cliente)' : ''}
        </Text>
        {item.type === 'folder' && (
          <View style={styles.contentActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleEditFolder(item)}>
              <Text style={styles.actionButtonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteFolder(item)}>
              <Text style={styles.actionButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Operaciones para agregar, editar y eliminar carpetas
  const handleAddFolder = async () => {
    if (!canAddFolder) {
      Alert.alert("Acción no permitida", "Debes seleccionar un cliente o carpeta para agregar una nueva carpeta.");
      return;
    }
    // Aquí se podría abrir un modal o formulario para solicitar el nombre; en este ejemplo se usa un valor fijo.
    const folderName = 'Nueva Carpeta';
    try {
      const parentId = selectedNode.id; // Se agrega dentro del nodo seleccionado (cliente o folder)
      await FolderTreeResource.addFolder({ name: folderName, folder_image_file_id: null }, parentId);
      await loadTree();
      // Luego de recargar el árbol, se vuelve a seleccionar el mismo nodo
      const updatedTree = FolderTreeResource.getTree();
      const findUpdated = (nodes) => {
        for (let node of nodes) {
          if (node.id === parentId) return node;
          if (node.children && node.children.length > 0) {
            const found = findUpdated(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const newSelected = findUpdated(updatedTree);
      setSelectedNode(newSelected);
      Alert.alert("Éxito", "Carpeta agregada");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleEditFolder = async (node) => {
    if (node.type !== 'folder') return;
    // Para este ejemplo se usa un nuevo nombre fijo; en una aplicación real usarías un formulario/modal.
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
              if (selectedNode && selectedNode.id === node.id) {
                setSelectedNode(null);
                setSidebarVisible(true);
              }
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  // Si la sidebar está oculta, se muestra un botón para reabrirla
  const renderToggleSidebarButton = () => {
    if (!sidebarVisible) {
      return (
        <TouchableOpacity style={styles.toggleSidebarButton} onPress={() => setSidebarVisible(true)}>
          <Text style={styles.toggleSidebarText}>☰ Abrir Menú</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* Sidebar visible solo cuando sidebarVisible es true */}
      {showSidebar && (
        <View style={styles.sidebar}>
          <ScrollView>{tree.map(node => renderSidebarNode(node))}</ScrollView>
        </View>
      )}
      {/* Panel de contenido: ocupa todo el ancho si se oculta la sidebar */}
      <View style={[styles.contentArea, !showSidebar && { width: '100%' }]}>
        {/* Botón para reabrir la sidebar cuando está oculta */}
        {renderToggleSidebarButton()}
        {/* Breadcrumb siempre visible */}
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
        {/* Lista de hijos del nodo seleccionado o de la raíz */}
        <ScrollView style={styles.contentList}>
          {getCurrentChildren().length > 0 ? (
            getCurrentChildren().map(child => renderContentItem(child))
          ) : (
            <Text style={styles.noContentText}>No hay elementos en este nivel.</Text>
          )}
        </ScrollView>
        {/* Botón para agregar carpeta: se muestra siempre que exista un nodo seleccionado */}
        {canAddFolder && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.addButton} onPress={handleAddFolder}>
              <Text style={styles.addButtonText}>+ Agregar Carpeta</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Botón de retroceso, visible siempre que haya un nodo seleccionado */}
        {selectedNode && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>◀ Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250,
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  contentArea: { flex: 1, padding: 10 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sidebarNode: { paddingVertical: 8, paddingHorizontal: 5 },
  selectedSidebarNode: { backgroundColor: '#cce5ff' },
  sidebarNodeText: { fontSize: 16 },
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
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: 5,
    backgroundColor: '#007BFF',
    borderRadius: 5,
  },
  backButtonText: { color: '#fff', fontSize: 16 },
  toggleSidebarButton: {
    padding: 10,
    backgroundColor: '#007BFF',
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  toggleSidebarText: { color: '#fff', fontSize: 16 },
});
