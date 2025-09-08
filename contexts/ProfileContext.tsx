// ProfileContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import {
  createSyncQueueTable,
  enqueueOperation,
  getAllQueueItems,
  deleteQueueItem,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalProfileTable,
  getProfileLocal,
  saveProfileLocal,
} from '@/src/database/profileLocalDB';

export interface ProfileDetails {
  id?: number;
  full_name: string;
  phone: string;
  address: string;
  cuit: string;
  profile_file_id?: string;
  syncStatus?: 'pending' | 'error';
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
  processQueue: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const { userId, token, logout } = useContext(AuthContext);
  const router = useRouter();

  const loadProfile = async () => {
    if (!userId) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localProfile = await getProfileLocal();
      if (localProfile) setProfileDetails(localProfile as ProfileDetails);
      return;
    }
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const profile = data.profile as ProfileDetails;
        setProfileDetails(profile);
        await saveProfileLocal(profile);
      } else {
        console.error('Error loading profile');
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const updateProfile = async (profileForm: ProfileForm) => {
    if (!token) return;
    const state = await NetInfo.fetch();
    const payload = {
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      address: profileForm.address,
      cuit: profileForm.cuit,
      profile_file_id:
        profileForm.profile_file_id === '' ? null : parseInt(profileForm.profile_file_id),
    };
    if (!state.isConnected) {
      setProfileDetails(prev =>
        prev ? { ...prev, ...profileForm, syncStatus: 'pending' } : { ...profileForm, syncStatus: 'pending' },
      );
      await saveProfileLocal({ id: profileDetails?.id ?? userId, ...payload });
      await enqueueOperation('user_profile', 'update', payload, profileDetails?.id ?? null, null);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setProfileDetails(prev => (prev ? { ...prev, ...profileForm } : null));
        await saveProfileLocal({ id: profileDetails?.id ?? userId, ...payload });
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error updating profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateImage = async (newFileId: string, profileForm: ProfileForm) => {
    if (!token) return;
    const state = await NetInfo.fetch();
    const payload = {
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      address: profileForm.address,
      cuit: profileForm.cuit,
      profile_file_id: newFileId,
    };
    if (!state.isConnected) {
      setProfileDetails(prev =>
        prev
          ? { ...prev, profile_file_id: newFileId, syncStatus: 'pending' }
          : { ...payload, syncStatus: 'pending' },
      );
      await saveProfileLocal({ id: profileDetails?.id ?? userId, ...payload });
      await enqueueOperation('user_profile', 'update', payload, profileDetails?.id ?? null, null);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await loadProfile();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error updating profile image');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

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
      ],
    );
  };

  const processQueue = async () => {
    if (!token) return;
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      if (item.table_name !== 'user_profile') continue;
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
          setProfileDetails(prev =>
            prev ? { ...prev, ...payload, syncStatus: undefined } : { ...payload },
          );
          await saveProfileLocal({ id: profileDetails?.id ?? userId, ...payload });
          await deleteQueueItem(item.id);
        } else {
          await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
          break;
        }
      } catch (err: any) {
        await updateQueueItemStatus(item.id, 'error', String(err));
        break;
      }
    }
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalProfileTable();
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue().catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) return;
    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadProfile();
      } catch (e) {}
    };
    sync();
  }, [token]);

  return (
    <ProfileContext.Provider
      value={{ profileDetails, loadProfile, updateProfile, updateImage, deleteAccount, processQueue }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

