// src/contexts/ConfigContext.tsx
import React, { createContext, useState, ReactNode, useEffect, useContext } from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface ConfigDetails {
  role: string;
  view_type: string;
  theme: string;
  font_size: string;
}

export interface ConfigForm {
  role: string;
  view_type: string;
  theme: string;
  font_size: string;
}

interface ConfigContextType {
  configDetails: ConfigDetails | null;
  loadConfig: () => Promise<void>;
  updateConfig: (configForm: ConfigForm) => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configDetails, setConfigDetails] = useState<ConfigDetails | null>(null);
  const { userId, token } = useContext(AuthContext);

  const loadConfig = async (): Promise<void> => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const configuration = data.configuration as ConfigDetails;
        setConfigDetails(configuration);
      } else {
        console.error('Error al obtener la configuración');
      }
    } catch (error: any) {
      console.error('Error en fetch de configuración:', error);
    }
  };

  const updateConfig = async (configForm: ConfigForm): Promise<void> => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configForm),
      });
      if (response.ok) {
        // Actualiza el estado combinando la configuración previa con los nuevos datos
        setConfigDetails((prev) => (prev ? { ...prev, ...configForm } : null));
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error actualizando configuración');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    // Ejecutamos loadConfig cuando ya tengamos userId y token desde AuthContext
    if (userId && token) {
      void loadConfig();
    }
  }, [userId, token]);

  return (
    <ConfigContext.Provider value={{ configDetails, loadConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
