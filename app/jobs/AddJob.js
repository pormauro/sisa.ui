import React, { useState, useEffect } from 'react';
import { 
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Button,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BASE_URL } from '../../src/config/index';
import { pickAndProcessImage, uploadImage } from '../../src/utils/imageUtils';
import { Picker } from '@react-native-picker/picker';

export default function AddJob() {
  const router = useRouter();
  const [form, setForm] = useState({
    client_id: '',
    folder_id: '',
    description: '',
    job_date: '',
    start_time: '',
    end_time: '',
    tariff_id: '',
    manual_amount: '',
    attached_files: [],
  });

  // States for dropdowns
  const [clients, setClients] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [folders, setFolders] = useState([]);

  // States for handling attachments
  const [localAttachments, setLocalAttachments] = useState([]);
  const [loadingAttachment, setLoadingAttachment] = useState(false);

  // Load clients and tariffs on mount
  useEffect(() => {
    loadClients();
    loadTariffs();
  }, []);

  // When client_id changes, load folders for that client
  useEffect(() => {
    if (form.client_id) {
      loadFolders(form.client_id);
    } else {
      setFolders([]);
      setForm(prev => ({ ...prev, folder_id: '' }));
    }
  }, [form.client_id]);

  const loadClients = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        Alert.alert('Error', 'Unable to fetch clients');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const loadTariffs = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/tariffs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTariffs(data.tariffs || []);
      } else {
        Alert.alert('Error', 'Unable to fetch tariffs');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const loadFolders = async (clientId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/folders?client_id=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      } else {
        Alert.alert('Error', 'Unable to fetch folders for the client');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleAddAttachment = async () => {
    Alert.alert(
      'Select File',
      'Do you want to use the camera or gallery?',
      [
        { text: 'Camera', onPress: () => pickAndUploadAttachment(true) },
        { text: 'Gallery', onPress: () => pickAndUploadAttachment(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickAndUploadAttachment = async (fromCamera) => {
    try {
      setLoadingAttachment(true);
      const localUri = await pickAndProcessImage(fromCamera);
      if (!localUri) {
        setLoadingAttachment(false);
        return;
      }
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoadingAttachment(false);
        return;
      }
      const fileId = await uploadImage(localUri, token);
      if (fileId) {
        setForm(prev => ({
          ...prev,
          attached_files: [...prev.attached_files, fileId],
        }));
        setLocalAttachments(prev => ([...prev, { fileId, uri: localUri }]));
      } else {
        Alert.alert('Error', 'File upload failed');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoadingAttachment(false);
    }
  };

  const handleSave = async () => {
    if (!form.client_id) {
      Alert.alert('Error', 'Please select a client');
      return;
    }
    if (!form.description) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!form.start_time || !form.end_time) {
      Alert.alert('Error', 'Please provide start and end times');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      console.log(response);
      if (response.ok) {
        Alert.alert('Success', 'Job created');
        router.back();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error saving job');
        
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add Job</Text>

      {/* Client Picker */}
      <Text style={styles.label}>Client:</Text>
      <Picker
        selectedValue={form.client_id}
        onValueChange={(itemValue) => setForm({ ...form, client_id: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Select a client" value="" />
        {clients.map(client => (
          <Picker.Item key={client.id} label={client.business_name} value={client.id} />
        ))}
      </Picker>

      {/* Folder Picker */}
      <Text style={styles.label}>Folder:</Text>
      <Picker
        selectedValue={form.folder_id}
        onValueChange={(itemValue) => setForm({ ...form, folder_id: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Select a folder" value="" />
        {folders.map(folder => (
          <Picker.Item key={folder.id} label={folder.name} value={folder.id} />
        ))}
      </Picker>

      {/* Description */}
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={form.description}
        onChangeText={(text) => setForm({ ...form, description: text })}
      />
      {/* Job Date */}
      <TextInput
        style={styles.input}
        placeholder="Job Date (YYYY-MM-DD)"
        value={form.job_date}
        onChangeText={(text) => setForm({ ...form, job_date: text })}
      />

      {/* Start Time */}
      <TextInput
        style={styles.input}
        placeholder="Start Time (YYYY-MM-DD HH:MM)"
        value={form.start_time}
        onChangeText={(text) => setForm({ ...form, start_time: text })}
      />

      {/* End Time */}
      <TextInput
        style={styles.input}
        placeholder="End Time (YYYY-MM-DD HH:MM)"
        value={form.end_time}
        onChangeText={(text) => setForm({ ...form, end_time: text })}
      />

      {/* Tariff Picker */}
      <Text style={styles.label}>Tariff:</Text>
      <Picker
        selectedValue={form.tariff_id}
        onValueChange={(itemValue) => setForm({ ...form, tariff_id: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Select a tariff" value="" />
        {tariffs.map(t => (
          <Picker.Item key={t.id} label={t.name} value={t.id} />
        ))}
      </Picker>

      {/* Manual Amount */}
      <TextInput
        style={styles.input}
        placeholder="Manual Amount"
        value={form.manual_amount}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, manual_amount: text })}
      />

      {/* Attachments */}
      <View style={styles.attachmentsContainer}>
        <Text style={styles.sectionTitle}>Attached Files:</Text>
        {localAttachments.length > 0 ? (
          localAttachments.map((att, index) => (
            <View key={index} style={styles.attachmentItem}>
              <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
            </View>
          ))
        ) : (
          <Text>No files added</Text>
        )}
        {loadingAttachment && <ActivityIndicator style={styles.loaderAttachment} />}
        <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddAttachment}>
          <Text style={styles.addAttachmentButtonText}>Add File</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Create</Text>
      </TouchableOpacity>
      <Button title="Cancel" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, marginVertical: 5 },
  input: { 
    borderWidth: 1, 
    padding: 10, 
    marginVertical: 5, 
    borderRadius: 5, 
    fontSize: 16, 
    backgroundColor: '#fff' 
  },
  picker: {
    borderWidth: 1,
    borderRadius: 5,
    marginVertical: 5,
  },
  attachmentsContainer: { marginVertical: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  attachmentItem: { marginBottom: 10 },
  attachmentImage: { width: 80, height: 80, borderRadius: 8 },
  addAttachmentButton: { 
    backgroundColor: '#007BFF', 
    padding: 10, 
    borderRadius: 5, 
    alignItems: 'center' 
  },
  addAttachmentButtonText: { color: '#fff', fontWeight: 'bold' },
  loaderAttachment: { marginTop: 10 },
  saveButton: { 
    backgroundColor: '#007BFF', 
    padding: 15, 
    borderRadius: 10, 
    marginVertical: 10, 
    alignItems: 'center' 
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
