// AppNavigator.js (o el archivo donde configuras la navegación)
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import FolderExplorer from './FolderExplorer'; // Ajusta la ruta según corresponda

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="FolderExplorer">
      <Stack.Screen 
        name="FolderExplorer" 
        component={FolderExplorer} 
        options={{ headerShown: false }} 
      />
      {/* Agrega otros screens aquí si es necesario */}
    </Stack.Navigator>
  );
}
