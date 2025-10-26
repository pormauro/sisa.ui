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
    background: '#ffffff',
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

export const StatusColorPalette = [
  '#F94144',
  '#F3722C',
  '#F8961E',
  '#F9844A',
  '#F9C74F',
  '#90BE6D',
  '#43AA8B',
  '#4D908E',
  '#577590',
  '#277DA1',
  '#9B5DE5',
  '#6A4C93',
];
