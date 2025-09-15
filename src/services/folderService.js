import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';

const getToken = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Authentication token not found');
  return token;
};

export const fetchFolders = async () => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/folders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error fetching folders');
  }
  const data = await response.json();
  return data.folders || [];
};

export const deleteFolder = async (folderId) => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error deleting folder');
  }
  return true;
};

export const editFolder = async (folderId, updatedData) => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error updating folder');
  }
  const data = await response.json();
  return data.folder;
};

