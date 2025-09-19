import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

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
  const [profiles, setProfiles] = useCachedState<Profile[]>(
    'profiles_list',
    []
  );

  const loadProfiles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }, [setProfiles, token]);

  useEffect(() => {
    if (token) {
      void loadProfiles();
    }
  }, [loadProfiles, token]);

  return (
    <ProfilesListContext.Provider value={{ profiles, loadProfiles }}>
      {children}
    </ProfilesListContext.Provider>
  );
};

