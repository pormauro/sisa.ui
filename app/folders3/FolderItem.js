// app/folders/FolderItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function FolderItem({ folder, onPress, onLongPress }) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.iconContainer}>
        <Text style={styles.folderIcon}>📁</Text>
      </View>
      <Text style={styles.folderName} numberOfLines={1}>
        {folder.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderIcon: {
    fontSize: 50,
  },
  folderName: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
  },
});
