// src/services/FolderTreeResource.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';

class FolderTreeResource {
  constructor() {
    this.tree = [];
  }

  async handleAuth(response) {
    if ([401, 403, 419].includes(response.status)) {
      await AsyncStorage.removeItem('token');
      throw new Error('Token inválido o expirado. Inicie sesión nuevamente.');
    }
  }

  /**
   * Carga el árbol completo de carpetas:
   * - Solicita todos los clientes y los mapea como nodos raíz (type: 'client').
   * - Solicita todas las carpetas y las mapea (type: 'folder').
   * Luego asocia cada carpeta a su nodo padre según parent_id o client_id.
   * @returns {Array} Árbol completo
   */
  async load() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      // Obtener clientes
      const clientsResponse = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await this.handleAuth(clientsResponse);
      if (!clientsResponse.ok) {
        throw new Error('Error fetching clients');
      }
      const clientsData = await clientsResponse.json();
      const clients = clientsData.clients || [];
      const clientNodes = clients.map(client => ({
         id: client.id.toString(),
         type: 'client',
         parentId: null,
         fileId: client.brand_file_id,
         name: client.business_name,
         children: [],
      }));

      // Obtener carpetas
      const foldersResponse = await fetch(`${BASE_URL}/folders`, {
         headers: { Authorization: `Bearer ${token}` },
      });
      await this.handleAuth(foldersResponse);
      if (!foldersResponse.ok) {
         throw new Error('Error fetching folders');
      }
      const foldersData = await foldersResponse.json();
      const folders = foldersData.folders || [];
      const folderNodes = folders.map(folder => ({
         id: folder.id.toString(),
         type: 'folder',
         // Se usa folder.parent_id si existe; de lo contrario, se usa folder.client_id
         parentId: folder.parent_id 
                      ? folder.parent_id.toString() 
                      : (folder.client_id ? folder.client_id.toString() : null),
         fileId: folder.folder_image_file_id,
         name: folder.name,
         children: [],
      }));

      // Crear un mapa de nodos para facilitar la asociación
      const nodeMap = {};
      clientNodes.forEach(node => { nodeMap[node.id] = node; });
      folderNodes.forEach(node => { nodeMap[node.id] = node; });

      // Armar el árbol: los clientes son raíz; se insertan las carpetas según su parentId
      const tree = [...clientNodes];
      folderNodes.forEach(node => {
         if (node.parentId && nodeMap[node.parentId]) {
            nodeMap[node.parentId].children.push(node);
         } else {
            // Si no se encontró un padre válido, se agrega a la raíz (aunque esto no debería ocurrir)
            tree.push(node);
         }
      });

      this.tree = tree;
      return tree;
    } catch (error) {
      console.error("Error loading folder tree:", error);
      throw error;
    }
  }

  /**
   * Devuelve el árbol en memoria.
   */
  getTree() {
    return this.tree;
  }

  /**
   * Agrega una nueva carpeta en el servidor y actualiza el árbol en memoria.
   * @param {Object} newFolderData - Datos de la carpeta (al menos { name, folder_image_file_id, … })
   * @param {string|null} parentId - Id del nodo padre (cliente o carpeta)
   * @returns {Object} El nuevo nodo de carpeta
   */
  async addFolder(newFolderData, parentId) {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      // Se envía el payload al endpoint; se espera que el servidor retorne la carpeta creada
      const payload = {
         ...newFolderData,
         parent_id: parentId,
      };
      const response = await fetch(`${BASE_URL}/folders`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify(payload),
      });
      await this.handleAuth(response);
      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Error adding folder');
      }
      const data = await response.json();
      const folder = data.folder; // Se asume que la respuesta contiene { folder: {...} }
      const newNode = {
         id: folder.id.toString(),
         type: 'folder',
         parentId: folder.parent_id 
                      ? folder.parent_id.toString() 
                      : (folder.client_id ? folder.client_id.toString() : null),
         fileId: folder.folder_image_file_id,
         name: folder.name,
         children: [],
      };

      // Función recursiva para agregar el nuevo nodo al árbol
      const addNodeToTree = (nodes) => {
         for (let node of nodes) {
           if (node.id === newNode.parentId) {
             node.children.push(newNode);
             return true;
           }
           if (node.children && node.children.length > 0) {
             if (addNodeToTree(node.children)) return true;
           }
         }
         return false;
      };

      if (newNode.parentId && !addNodeToTree(this.tree)) {
         // Si no se encontró padre, se agrega a la raíz
         this.tree.push(newNode);
      } else if (!newNode.parentId) {
         this.tree.push(newNode);
      }

      return newNode;
    } catch (error) {
      console.error("Error adding folder:", error);
      throw error;
    }
  }

  /**
   * Actualiza una carpeta en el servidor y actualiza el árbol en memoria.
   * @param {string} folderId - Id de la carpeta a actualizar
   * @param {Object} updatedData - Datos actualizados (por ejemplo, { name, folder_image_file_id, … })
   * @returns {Object} La carpeta actualizada (según el servidor)
   */
  async updateFolder(folderId, updatedData) {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify(updatedData),
      });
      await this.handleAuth(response);
      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Error updating folder');
      }
      const data = await response.json();
      const updatedFolder = data.folder; // Se espera { folder: {...} }

      // Función recursiva para actualizar el nodo en el árbol
      const updateNodeRecursively = (nodes) => {
         for (let node of nodes) {
           if (node.id === folderId.toString()) {
             node.name = updatedFolder.name || node.name;
             node.fileId = updatedFolder.folder_image_file_id || node.fileId;
             return true;
           }
           if (node.children && node.children.length > 0) {
             if (updateNodeRecursively(node.children)) return true;
           }
         }
         return false;
      };

      updateNodeRecursively(this.tree);
      return updatedFolder;
    } catch (error) {
      console.error("Error updating folder:", error);
      throw error;
    }
  }

  /**
   * Elimina una carpeta en el servidor y actualiza el árbol en memoria.
   * @param {string} folderId - Id de la carpeta a eliminar
   * @returns {boolean} true si se eliminó correctamente
   */
  async deleteFolder(folderId) {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
         method: 'DELETE',
         headers: {
           Authorization: `Bearer ${token}`,
         },
      });
      await this.handleAuth(response);
      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Error deleting folder');
      }

      // Función recursiva para eliminar el nodo del árbol
      const removeNodeRecursively = (nodes) => {
         for (let i = 0; i < nodes.length; i++) {
           if (nodes[i].id === folderId.toString()) {
             nodes.splice(i, 1);
             return true;
           }
           if (nodes[i].children && nodes[i].children.length > 0) {
             if (removeNodeRecursively(nodes[i].children)) return true;
           }
         }
         return false;
      };

      removeNodeRecursively(this.tree);
      return true;
    } catch (error) {
      console.error("Error deleting folder:", error);
      throw error;
    }
  }
}

export default new FolderTreeResource();
