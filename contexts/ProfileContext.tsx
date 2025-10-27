// ProfileContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

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
  updateImage: (newFileId: string | null, profileForm: ProfileForm) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profileDetails, setProfileDetails] = useCachedState<ProfileDetails | null>(
    'profile',
    null
  );
  const { userId, token, logout } = useContext(AuthContext);
  const router = useRouter();

  // Cargar perfil desde el servidor
  const loadProfile = async () => {
    if (!userId || !token) return;
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
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          address: profileForm.address,
          cuit: profileForm.cuit,
          profile_file_id:
            profileForm.profile_file_id === '' ? null : parseInt(profileForm.profile_file_id),
        }),
      });
      if (response.ok) {
        let responseData: any = null;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          responseData = null;
        }

        if (responseData?.profile) {
          const updatedProfile = responseData.profile as ProfileDetails;
          setProfileDetails(prev => (prev ? { ...prev, ...updatedProfile } : updatedProfile));
        } else if (
          responseData &&
          ['full_name', 'phone', 'address', 'cuit', 'profile_file_id'].some(key => key in responseData)
        ) {
          const updatedProfile = responseData as ProfileDetails;
          setProfileDetails(prev => (prev ? { ...prev, ...updatedProfile } : updatedProfile));
        } else {
          await loadProfile();
        }
      } else {
        let errData: any = null;
        try {
          errData = await response.json();
        } catch (jsonError) {
          errData = null;
        }
        Alert.alert('Error', errData?.error || 'Error updating profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Actualizar imagen de perfil
  const updateImage = async (newFileId: string | null, profileForm: ProfileForm) => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          address: profileForm.address,
          cuit: profileForm.cuit,
          profile_file_id: newFileId ? parseInt(newFileId, 10) : null,
        }),
      });
      if (response.ok) {
        // Recargamos el perfil para reflejar los cambios
        await loadProfile();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error updating profile image');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
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
