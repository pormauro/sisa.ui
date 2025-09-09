import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import NetInfo from '@react-native-community/netinfo';
import { saveProfilesLocal, getProfilesLocal } from '@/src/database/profilesLocalDB';

export interface Profile {
  id: number;
  username: string;
  email: string;
  activated: number;
}

interface ProfilesListContextType {
  profiles: Profile[];
  loadProfiles: () => Promise<void>;
}

export const ProfilesListContext = createContext<ProfilesListContextType>({
  profiles: [],
  loadProfiles: async () => {},
});

export const ProfilesListProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const loadProfiles = useCallback(async () => {
    if (!token) return;
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        const localProfiles = await getProfilesLocal();
        setProfiles(localProfiles as Profile[]);
        return;
      }
      const res = await fetch(`${BASE_URL}/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
        await saveProfilesLocal(data.profiles);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      const localProfiles = await getProfilesLocal();
      setProfiles(localProfiles as Profile[]);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadProfiles();
    }
  }, [token, loadProfiles]);

  return (
    <ProfilesListContext.Provider value={{ profiles, loadProfiles }}>
      {children}
    </ProfilesListContext.Provider>
  );
};

