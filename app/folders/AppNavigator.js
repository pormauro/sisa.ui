// app/folders/AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ClientFoldersScreen from './ClientFoldersScreen';
import FolderExplorer from './FolderExplorer'; // Esta pantalla manejará tanto la vista de subcarpetas como la de clientes

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="ClientFoldersScreen">
      <Stack.Screen 
        name="ClientFoldersScreen" 
        component={ClientFoldersScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="FolderExplorer" 
        component={FolderExplorer} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}
