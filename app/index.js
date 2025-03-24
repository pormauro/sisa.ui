// App.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserProvider } from './UserContext';
import UserProfile from './UserProfile';

const App = () => {
  return (
    <UserProvider>
      <View style={styles.container}>
        <Text style={styles.title}>React Native useContext Example</Text>
        <UserProfile />
      </View>
    </UserProvider>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 20 
  },
});

export default App;
