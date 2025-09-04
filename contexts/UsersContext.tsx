import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface AppUser {
  id: number;
  username: string;
  profile_file_id?: string | null;
}

interface UsersContextValue {
  users: AppUser[];
  loadUsers: () => void;
}

export const UsersContext = createContext<UsersContextValue>({
  users: [],
  loadUsers: () => {},
});

export const UsersProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [users, setUsers] = useState<AppUser[]>([]);

  const loadUsers = async () => {
    try {
      const res = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    if (token) void loadUsers();
  }, [token]);

  return (
    <UsersContext.Provider value={{ users, loadUsers }}>
      {children}
    </UsersContext.Provider>
  );
};

