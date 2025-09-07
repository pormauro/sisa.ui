import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { ConfigContext } from '@/contexts/ConfigContext';

/**
 * Return the theme selected by the user in ConfigContext if available,
 * otherwise fall back to the system color scheme.
 */
export function useColorScheme() {
  const systemTheme = useRNColorScheme();
  const context = useContext(ConfigContext);
  const theme = context?.configDetails?.theme;
  if (theme === 'dark' || theme === 'light') {
    return theme;
  }
  return systemTheme;
}
