import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';

export default function JobItem({ item, expanded, onToggle, onDelete, onEdit }) {
  const handleToggle = () => {
    onToggle(item.id);
  };

  // Render attachment preview if available
  const renderAttachmentPreview = () => {
    if (item.attached_files && item.attached_files.length > 0) {
      // Asumimos que el backend devuelve URLs en attached_files_url
      const previewUri = item.attached_files_url && item.attached_files_url[0]
                           ? item.attached_files_url[0]
                           : null;
      if (previewUri) {
        return (
          <Image source={{ uri: previewUri }} style={styles.attachmentPreview} />
        );
      } else {
        return (
          <View style={styles.attachmentCounter}>
            <Text style={styles.attachmentCounterText}>{item.attached_files.length}</Text>
          </View>
        );
      }
    }
    return null;
  };

  return (
    <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
      <View style={styles.itemContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.jobTitle}>{item.description || 'Job'}</Text>
          {renderAttachmentPreview()}
        </View>
        {expanded && (
          <>
            <Text style={styles.jobDetail}>Start: {item.start_time || '-'}</Text>
            <Text style={styles.jobDetail}>End: {item.end_time || '-'}</Text>
            <Text style={styles.jobDetail}>Tariff: {item.tariff?.name || '-'}</Text>
            <Text style={styles.jobDetail}>Amount: {item.amount ?? item.manual_amount ?? '-'}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={() => onEdit(item.id)}>
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() =>
                  Alert.alert(
                    'Confirm',
                    'Are you sure you want to delete this job?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => onDelete(item.id),
                      },
                    ]
                  )
                }
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    width: '100%',
    backgroundColor: '#E2E2FA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  jobDetail: {
    fontSize: 16,
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF3333',
    marginRight: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  attachmentPreview: {
    width: 50,
    height: 50,
    borderRadius: 5,
  },
  attachmentCounter: {
    backgroundColor: '#007BFF',
    width: 50,
    height: 50,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentCounterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
