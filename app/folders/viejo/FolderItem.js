import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CircleImagePicker from '../../../src/components/CircleImagePicker';

const windowWidth = Dimensions.get('window').width;
const itemWidth = (windowWidth - 40) / 3; // Ajusta 40 según el padding/margin total

export default function FolderItem({ folder, onPress, onLongPress }) {
  return (
    <TouchableOpacity
      style={[styles.container, { width: itemWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.folderIcon}>📁</Text>
        {folder.image && (
          <View style={styles.imageCircle}>
            <CircleImagePicker fileId={folder.image} editable={false} size={40} />
          </View>
        )}
      </View>
      <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  folderIcon: {
    fontSize: 50,
  },
  imageCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    top: 35,
    left: 22,
  },
  folderName: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
  },
});
