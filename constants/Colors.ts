/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Depros brand colors
const deprosOrange = '#f15a29';
const deprosPurple = '#2f273e';
const deprosBlue = '#007BFF';

const tintColorLight = deprosBlue;
const tintColorDark = deprosOrange;

export const Colors = {
  light: {
    text: deprosPurple,
    background: '#f5f5f5',
    tint: tintColorLight,
    icon: deprosPurple,
    tabIconDefault: '#9389a3',
    tabIconSelected: tintColorLight,
    button: deprosBlue,
    buttonText: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    background: deprosPurple,
    tint: tintColorDark,
    icon: '#ffffff',
    tabIconDefault: '#b3b3b3',
    tabIconSelected: tintColorDark,
    button: '#ffffff',
    buttonText: deprosPurple,
  },
};
