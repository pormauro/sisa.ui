// @/styles/MenuStyles.ts
import { StyleSheet } from 'react-native';

export const menuStyles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f2f2f2',
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  menuText: {
    color: 'white',
    fontSize: 18,
  },
});
