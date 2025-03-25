// app/folders/FolderItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const FolderItem = ({ folder, level, onLongPress }) => {
  return (
    <>
      <TouchableOpacity onLongPress={() => onLongPress(folder.id)}>
        <View style={[styles.folderItem, { marginLeft: level * 20 }]}>
          {/* Dibuja una línea o ícono para indicar jerarquía */}
          <Text style={styles.folderText}>📁 {folder.name}</Text>
        </View>
      </TouchableOpacity>
      {folder.children &&
        folder.children.map((child) => (
          <FolderItem
            key={child.id}
            folder={child}
            level={level + 1}
            onLongPress={onLongPress}
          />
        ))}
    </>
  );
};

const styles = StyleSheet.create({
  folderItem: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginVertical: 5,
    backgroundColor: '#fafafa',
  },
  folderText: { fontSize: 16 },
});

export default FolderItem;
