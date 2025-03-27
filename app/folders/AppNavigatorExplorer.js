// app/folders/AppNavigatorExplorer.js
import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import FolderExplorerCustom from './FolderExplorerCustom';

export default function AppNavigatorExplorer() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <FolderExplorerCustom />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
