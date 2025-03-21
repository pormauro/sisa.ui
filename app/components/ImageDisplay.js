// ImageDisplay.js
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const ImageDisplay = ({ imageUri, style }) => {
  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={[styles.image, style]} />;
  }
  return <View style={[styles.image, styles.placeholder, style]} />;
};

const styles = StyleSheet.create({
  image: {
    width: 200,
    height: 200,
    borderRadius: 100,
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: 'blue',
  },
});

export default ImageDisplay;
