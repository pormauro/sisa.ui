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
    product_service_id: '',
    folder_id: '',
    type_of_work: '',
    description: '',
    status: '',
    start_datetime: '',
    end_datetime: '',
    multiplicative_value: '1.00',
    attached_files: [],
  });

  // States for dropdowns
  const [clients, setClients] = useState([]);
  const [productsServices, setProductsServices] = useState([]);
  const [folders, setFolders] = useState([]);

  // States for handling attachments
  const [localAttachments, setLocalAttachments] = useState([]);
  const [loadingAttachment, setLoadingAttachment] = useState(false);

  // Load clients and products/services on mount
  useEffect(() => {
    loadClients();
    loadProductsServices();
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

  const loadProductsServices = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/products_services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProductsServices(data.products_services || []);
      } else {
        Alert.alert('Error', 'Unable to fetch products/services');
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
    if (!form.product_service_id) {
      Alert.alert('Error', 'Please select a product or service');
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

  const statusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Canceled', value: 'canceled' },
  ];

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

      {/* Product/Service Picker */}
      <Text style={styles.label}>Product / Service:</Text>
      <Picker
        selectedValue={form.product_service_id}
        onValueChange={(itemValue) => setForm({ ...form, product_service_id: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Select a product or service" value="" />
        {productsServices.map(ps => (
          <Picker.Item key={ps.id} label={ps.description} value={ps.id} />
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

      {/* Type of Work */}
      <TextInput
        style={styles.input}
        placeholder="Type of work"
        value={form.type_of_work}
        onChangeText={(text) => setForm({ ...form, type_of_work: text })}
      />

      {/* Description */}
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={form.description}
        onChangeText={(text) => setForm({ ...form, description: text })}
      />

      {/* Status */}
      <Text style={styles.label}>Status:</Text>
      <Picker
        selectedValue={form.status}
        onValueChange={(itemValue) => setForm({ ...form, status: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Select a status" value="" />
        {statusOptions.map(status => (
          <Picker.Item key={status.value} label={status.label} value={status.value} />
        ))}
      </Picker>

      {/* Start Datetime */}
      <TextInput
        style={styles.input}
        placeholder="Start (YYYY-MM-DD HH:MM)"
        value={form.start_datetime}
        onChangeText={(text) => setForm({ ...form, start_datetime: text })}
      />

      {/* End Datetime */}
      <TextInput
        style={styles.input}
        placeholder="End (YYYY-MM-DD HH:MM)"
        value={form.end_datetime}
        onChangeText={(text) => setForm({ ...form, end_datetime: text })}
      />

      {/* Multiplicative Value */}
      <TextInput
        style={styles.input}
        placeholder="Multiplicative Value"
        value={form.multiplicative_value}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, multiplicative_value: text })}
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
