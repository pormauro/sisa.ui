import { PropsWithChildren } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function ThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme() ?? 'light';
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  const theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: Colors[colorScheme].tint,
      background: Colors[colorScheme].background,
      card: Colors[colorScheme].background,
      text: Colors[colorScheme].text,
      border: Colors[colorScheme].icon,
      notification: Colors[colorScheme].tint,
    },
  };

  return <NavigationThemeProvider value={theme}>{children}</NavigationThemeProvider>;
}
