import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import NetInfo from '@react-native-community/netinfo';
import {
  createLocalPermissionsTable,
  clearPermissionsByUserLocal,
  insertPermissionLocal,
  getPermissionsByUserLocal,
} from '@/src/database/permissionsLocalDB';

interface PermissionsContextProps {
  permissions: string[]; // Array de cadenas con los nombres de los permisos
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextProps>({
  permissions: [],
  loading: false,
  refreshPermissions: async () => {},
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, userId } = useContext(AuthContext);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPermissions = useCallback(async () => {
    // Si no hay token o userId, limpiamos los permisos.
    if (!token || !userId) {
      setPermissions([]);
      return;
    }
    setLoading(true);
    try {
      await createLocalPermissionsTable();
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        const [userLocal, globalLocal] = await Promise.all([
          getPermissionsByUserLocal(userId),
          getPermissionsByUserLocal(0),
        ]);
        const merged = Array.from(
          new Set([...userLocal, ...globalLocal].map((p: any) => p.sector)),
        );
        setPermissions(merged);
        return;
      }

      const [userRes, globalRes] = await Promise.all([
        fetch(`${BASE_URL}/permissions/user/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${BASE_URL}/permissions/global`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      const userData = await userRes.json();
      const globalData = await globalRes.json();

      const userPerms = userData.permissions || [];
      const globalPerms = globalData.permissions || [];

      const mergedPermissions = Array.from(
        new Set([
          ...userPerms.map((p: any) => p.sector),
          ...globalPerms.map((p: any) => p.sector),
        ]),
      );
      setPermissions(mergedPermissions);

      await clearPermissionsByUserLocal(userId);
      await clearPermissionsByUserLocal(0);
      for (const perm of userPerms) {
        await insertPermissionLocal({ id: perm.id, user_id: userId, sector: perm.sector });
      }
      for (const perm of globalPerms) {
        await insertPermissionLocal({ id: perm.id, user_id: 0, sector: perm.sector });
      }
    } catch (error) {
      console.error('Error fetching permissions', error);
      const [userLocal, globalLocal] = await Promise.all([
        getPermissionsByUserLocal(userId),
        getPermissionsByUserLocal(0),
      ]);
      const merged = Array.from(
        new Set([...userLocal, ...globalLocal].map((p: any) => p.sector)),
      );
      setPermissions(merged);
      console.error('Error: No se pudieron cargar los permisos.');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Refrescar periódicamente cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPermissions();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, refreshPermissions: fetchPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
};
