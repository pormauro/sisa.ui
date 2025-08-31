import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Alert } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

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
      // Se realizan ambas peticiones de forma concurrente:
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

      // Suponemos que la respuesta tiene la forma: { permissions: [ { id, sector, ... }, ... ] }
      const userPerms: string[] = userData.permissions?.map((p: any) => p.sector) || [];
      const globalPerms: string[] = globalData.permissions?.map((p: any) => p.sector) || [];
      
      // Unir ambas listas sin duplicados
      const mergedPermissions = Array.from(new Set([...userPerms, ...globalPerms]));
      setPermissions(mergedPermissions);
    } catch (error) {
      console.error("Error fetching permissions", error);
      Alert.alert("Error", "No se pudieron cargar los permisos.");
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
