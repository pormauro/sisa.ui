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
  profile_file_id: number | null;
  full_name?: string;
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

    const res = await fetch(`${BASE_URL}/profiles`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn('Error cargando perfiles', res.status);
      return;
    }

    const data = await res.json();

    const normalized: Profile[] = (data?.profiles ?? []).map((p: any) => ({
      id: Number(p.id),
      username: p.username,
      email: p.email,
      activated: Number(p.activated ?? 1),
      profile_file_id:
        p.profile_file_id !== null && p.profile_file_id !== undefined
          ? Number(p.profile_file_id)
          : null,
      full_name: p.full_name ?? undefined,
    }));

    setProfiles(normalized);
  }, [setProfiles, token]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  return (
    <ProfilesListContext.Provider value={{ profiles, loadProfiles }}>
      {children}
    </ProfilesListContext.Provider>
  );
};
