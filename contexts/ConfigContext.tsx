// src/contexts/ConfigContext.tsx
import React, { createContext, ReactNode, useEffect, useContext, useCallback } from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export interface ConfigDetails {
  role: string;
  view_type: string;
  theme: string;
  font_size: string;
  filter_config: unknown;
  default_payment_cash_box_id: number | null;
  default_receiving_cash_box_id: number | null;
  show_notifications_badge: boolean;
}

export type ConfigForm = ConfigDetails;

type NormalizedConfigInput = Partial<ConfigDetails> & {
  default_payment_cash_box_id?: unknown;
  default_receiving_cash_box_id?: unknown;
};

interface ConfigContextType {
  configDetails: ConfigDetails | null;
  loadConfig: () => Promise<void>;
  updateConfig: (configForm: ConfigForm) => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const DEFAULT_CONFIG: ConfigDetails = {
  role: '',
  view_type: '',
  theme: 'light',
  font_size: 'medium',
  filter_config: null,
  default_payment_cash_box_id: null,
  default_receiving_cash_box_id: null,
  show_notifications_badge: true,
};

const parseBooleanFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

function normalizeConfig(config: NormalizedConfigInput): ConfigDetails {
  return {
    role: config.role ?? DEFAULT_CONFIG.role,
    view_type: config.view_type ?? DEFAULT_CONFIG.view_type,
    theme: config.theme ?? DEFAULT_CONFIG.theme,
    font_size: config.font_size ?? DEFAULT_CONFIG.font_size,
    filter_config:
      typeof config.filter_config === 'undefined'
        ? DEFAULT_CONFIG.filter_config
        : config.filter_config,
    default_payment_cash_box_id: parseNullableNumber(
      typeof config.default_payment_cash_box_id === 'undefined'
        ? DEFAULT_CONFIG.default_payment_cash_box_id
        : config.default_payment_cash_box_id
    ),
    default_receiving_cash_box_id: parseNullableNumber(
      typeof config.default_receiving_cash_box_id === 'undefined'
        ? DEFAULT_CONFIG.default_receiving_cash_box_id
        : config.default_receiving_cash_box_id
    ),
    show_notifications_badge:
      typeof config.show_notifications_badge === 'undefined'
        ? DEFAULT_CONFIG.show_notifications_badge
        : parseBooleanFlag(config.show_notifications_badge),
  };
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configDetails, setConfigDetails] = useCachedState<ConfigDetails | null>(
    'config',
    null
  );
  const { userId, token } = useContext(AuthContext);

  const loadConfig = useCallback(async (): Promise<void> => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setConfigDetails(prev => {
          const mergedInput = {
            ...(prev ?? {}),
            ...(data.configuration ?? {}),
          } as NormalizedConfigInput;

          return normalizeConfig(mergedInput);
        });
      } else {
        // Se evita usar console.error para prevenir pantallas rojas en ausencia de conexión
        console.log('Error al obtener la configuración');
      }
    } catch (error: any) {
      // Se evita usar console.error para prevenir pantallas rojas en ausencia de conexión
      console.log('Error en fetch de configuración:', error);
    }
  }, [normalizeConfig, setConfigDetails, token, userId]);

  const updateConfig = useCallback(
    async (configForm: ConfigForm): Promise<void> => {
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
          setConfigDetails(prev =>
            prev
              ? normalizeConfig({ ...prev, ...configForm })
              : normalizeConfig({ ...configForm })
          );
        } else {
          const errData = await response.json();
          Alert.alert('Error', errData.error || 'Error actualizando configuración');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message);
      }
    },
    [normalizeConfig, setConfigDetails, token]
  );

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
