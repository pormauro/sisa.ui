import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  TextInput, 
  Alert, 
  Platform, 
  UIManager, 
  LayoutAnimation 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { BASE_URL } from '../../src/config/index';
import JobItem from './JobItem';

export default function JobsList() {
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await fetch(`${BASE_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(response);
      if (response.ok) {
        const data = await response.json();
        const allJobs = data.jobs || data;
        setJobs(allJobs);
        setFilteredJobs(allJobs);
      } else {
        Alert.alert('Error', 'Unable to fetch jobs');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredJobs(jobs);
      return;
    }
    const options = {
      keys: ['description'],
      threshold: 0.4,
      includeScore: true,
    };
    const fuse = new Fuse(jobs, options);
    const results = fuse.search(searchQuery);
    setFilteredJobs(results.map(result => result.item));
  }, [searchQuery, jobs]);

  const handleDelete = async (jobId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${BASE_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        Alert.alert('Success', 'Job deleted');
        loadJobs();
        if (expandedItemId === jobId) {
          setExpandedItemId(null);
        }
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error deleting job');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEdit = (jobId) => {
    router.push(`./EditJob?id=${jobId}`);
  };

  const handleToggle = (jobId) => {
    if (Platform.OS !== 'web' && LayoutAnimation && LayoutAnimation.configureNext) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedItemId(prev => (prev === jobId ? null : jobId));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search jobs..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <JobItem
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text>No jobs available.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  listContainer: { 
    marginTop: 20,
  },
  loader: { 
    marginTop: 20,
  },
});
