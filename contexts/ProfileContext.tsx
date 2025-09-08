// ProfileContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import NetInfo from '@react-native-community/netinfo';
import {
  createSyncQueueTable,
  enqueueOperation,
  getAllQueueItems,
  deleteQueueItem,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';

export interface ProfileDetails {
  id?: number;
  full_name: string;
  phone: string;
  address: string;
  cuit: string;
  profile_file_id?: string;
}

export interface ProfileForm {
  full_name: string;
  phone: string;
  address: string;
  cuit: string;
  profile_file_id: string;
}

interface ProfileContextType {
  profileDetails: ProfileDetails | null;
  loadProfile: () => Promise<void>;
  updateProfile: (profileForm: ProfileForm) => Promise<void>;
  updateImage: (newFileId: string, profileForm: ProfileForm) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const { userId, token, logout } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    createSyncQueueTable();
  }, []);

  const processQueue = async () => {
    if (!token) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      if (item.table_name === 'profile' && item.op === 'update') {
        try {
          const response = await fetch(`${BASE_URL}/user_profile`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: item.payload_json,
          });
          if (response.ok) {
            const payload = JSON.parse(item.payload_json);
            setProfileDetails(prev => (prev ? { ...prev, ...payload } : payload));
            await deleteQueueItem(item.id);
          } else {
            await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
            break;
          }
        } catch (error: any) {
          await updateQueueItemStatus(item.id, 'error', error.message);
          break;
        }
      }
    }
  };

  // Cargar perfil desde el servidor
  const loadProfile = async () => {
    if (!userId || !token) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      Alert.alert('Sin conexión', 'No se pudo cargar el perfil.');
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const profile = data.profile as ProfileDetails;
        setProfileDetails(profile);
      } else {
        console.error('Error loading profile');
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  // Actualizar perfil (PUT)
  const updateProfile = async (profileForm: ProfileForm) => {
    const payload = {
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      address: profileForm.address,
      cuit: profileForm.cuit,
      profile_file_id:
        profileForm.profile_file_id === '' ? null : parseInt(profileForm.profile_file_id, 10),
    };
    setProfileDetails(prev => (prev ? { ...prev, ...payload } : payload));
    await enqueueOperation('profile', 'update', payload, profileDetails?.id ?? null, null);
    await processQueue();
  };

  // Actualizar imagen de perfil
  const updateImage = async (newFileId: string, profileForm: ProfileForm) => {
    await updateProfile({ ...profileForm, profile_file_id: newFileId });
  };

  // Eliminar cuenta
  const deleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token || !userId) return;
            try {
              const response = await fetch(`${BASE_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                await AsyncStorage.clear();
                Alert.alert('Account deleted');
                await logout();
                router.replace('./login');
              } else {
                Alert.alert('Error', 'Could not delete account.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ProfileContext.Provider
      value={{ profileDetails, loadProfile, updateProfile, updateImage, deleteAccount }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
