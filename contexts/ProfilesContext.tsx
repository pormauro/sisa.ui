// /contexts/ProfilesContext.tsx
import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  address: string;
  cuit: string;
  profile_file_id: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ProfilesContextType {
  profiles: Record<number, UserProfile>;
  getProfile: (userId: number) => Promise<UserProfile | null>;
}

export const ProfilesContext = createContext<ProfilesContextType>({
  profiles: {},
  getProfile: async () => null,
});

export const ProfilesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});

  const getProfile = useCallback(
    async (userId: number): Promise<UserProfile | null> => {
      if (profiles[userId]) {
        return profiles[userId];
      }
      if (!token) return null;
      try {
        const response = await fetch(`${BASE_URL}/user_profiles/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return null;
        const data = await response.json();
        const profile: UserProfile = data.profile;
        setProfiles(prev => ({ ...prev, [userId]: profile }));
        return profile;
      } catch {
        return null;
      }
    },
    [profiles, token],
  );

  return (
    <ProfilesContext.Provider value={{ profiles, getProfile }}>
      {children}
    </ProfilesContext.Provider>
  );
};

