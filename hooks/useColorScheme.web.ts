import { useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { ConfigContext } from '@/contexts/ConfigContext';

/**
 * To support static rendering, the color scheme needs to be re-calculated on
 * the client side for web. Respect the theme stored in ConfigContext when
 * available.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const systemTheme = useRNColorScheme();
  const context = useContext(ConfigContext);
  const theme = context?.configDetails?.theme;
  const chosen = theme === 'dark' || theme === 'light' ? theme : systemTheme;

  if (hasHydrated) {
    return chosen;
  }

  return 'light';
}
