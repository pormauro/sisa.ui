/**
 * FolderResource.js
 *
 * Este recurso administra un árbol de carpetas en memoria.
 * Exporta funciones para:
 *  - getFolderTree(): obtener el árbol completo de carpetas.
 *  - addFolder(newFolderData, parentId): agregar una carpeta nueva.
 *  - updateFolder(folderId, updatedData): modificar una carpeta existente.
 *  - deleteFolder(folderId): eliminar una carpeta.
 *
 * Las carpetas se organizan de forma jerárquica: cada carpeta tiene un id, un nombre,
 * un parentId (null si es de raíz) y un array de children.
 */

// Árbol de carpetas de ejemplo
const folderTree = [
    {
      id: '1',
      name: 'Documents',
      parentId: null,
      children: [
        { id: '11', name: 'Work Documents', parentId: '1', children: [] },
        { id: '12', name: 'Personal Documents', parentId: '1', children: [] },
      ],
    },
    {
      id: '2',
      name: 'Photos',
      parentId: null,
      children: [
        { id: '21', name: 'Vacations', parentId: '2', children: [] },
        { id: '22', name: 'Family', parentId: '2', children: [] },
      ],
    },
    {
      id: '3',
      name: 'Music',
      parentId: null,
      children: [],
    },
  ];
  
  /**
   * Retorna el árbol completo de carpetas.
   */
  function getFolderTree() {
    return folderTree;
  }
  
  /**
   * Agrega una carpeta nueva.
   * @param {Object} newFolderData - Objeto con al menos la propiedad "name".
   * @param {string|null} parentId - Id de la carpeta padre; si es null se agrega a raíz.
   * @returns {Object} La carpeta agregada.
   */
  function addFolder(newFolderData, parentId = null) {
    const newFolder = {
      id: Date.now().toString(), // Se usa el timestamp como id único
      name: newFolderData.name,
      parentId: parentId,
      children: [],
    };
  
    if (parentId === null) {
      folderTree.push(newFolder);
    } else {
      const parentFolder = findFolderById(folderTree, parentId);
      if (!parentFolder) {
        throw new Error('Parent folder not found');
      }
      parentFolder.children.push(newFolder);
    }
    return newFolder;
  }
  
  /**
   * Actualiza una carpeta existente.
   * @param {string} folderId - Id de la carpeta a actualizar.
   * @param {Object} updatedData - Objeto con los campos a actualizar (por ejemplo, name).
   * @returns {Object} La carpeta actualizada.
   */
  function updateFolder(folderId, updatedData) {
    const folder = findFolderById(folderTree, folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }
    // Actualiza los campos; en este ejemplo se actualiza el nombre.
    folder.name = updatedData.name || folder.name;
    // Puedes agregar más actualizaciones si fuera necesario.
    return folder;
  }
  
  /**
   * Elimina una carpeta del árbol.
   * @param {string} folderId - Id de la carpeta a eliminar.
   * @returns {boolean} true si se eliminó la carpeta; de lo contrario se lanza un error.
   */
  function deleteFolder(folderId) {
    const success = deleteFolderRecursive(folderTree, folderId);
    if (!success) {
      throw new Error('Folder not found');
    }
    return true;
  }
  
  /* Funciones auxiliares */
  
  /**
   * Busca una carpeta por id de forma recursiva.
   * @param {Array} folders - Array de carpetas.
   * @param {string} id - Id a buscar.
   * @returns {Object|null} La carpeta encontrada o null.
   */
  function findFolderById(folders, id) {
    for (const folder of folders) {
      if (folder.id === id) {
        return folder;
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolderById(folder.children, id);
        if (found) return found;
      }
    }
    return null;
  }
  
  /**
   * Elimina una carpeta (y sus subcarpetas) de un array de carpetas de forma recursiva.
   * @param {Array} folders - Array de carpetas.
   * @param {string} id - Id de la carpeta a eliminar.
   * @returns {boolean} true si se eliminó, false en caso contrario.
   */
  function deleteFolderRecursive(folders, id) {
    const index = folders.findIndex(folder => folder.id === id);
    if (index !== -1) {
      folders.splice(index, 1);
      return true;
    }
    for (const folder of folders) {
      if (folder.children && folder.children.length > 0) {
        const success = deleteFolderRecursive(folder.children, id);
        if (success) return true;
      }
    }
    return false;
  }
  
  export { getFolderTree, addFolder, updateFolder, deleteFolder };
  