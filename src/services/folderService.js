import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';

/**
 * Delete a folder by id.
 * @param {string|number} folderId
 */
export async function deleteFolder(folderId) {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error deleting folder');
  }

  return true;
}

/**
 * Edit a folder by id.
 * @param {string|number} folderId
 * @param {Object} newFolderData
 * @returns {Object} updated folder
 */
export async function editFolder(folderId, newFolderData) {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(newFolderData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error editing folder');
  }

  const data = await response.json();
  return data.folder || data;
}
