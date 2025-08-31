import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import JobsList from './JobsList';

export default function JobsScreen() {
  const router = useRouter();

  const handleAddJob = () => {
    router.push('./AddJob');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jobs</Text>
      <JobsList />
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddJob}>
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 10,
    textAlign: 'center' 
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007BFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  floatingButtonText: { 
    fontSize: 30, 
    color: '#fff', 
    marginTop: -4 
  },
});
