// @/styles/GlobalStyles.ts
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#2f273e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginTop: 15,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
  },
});
