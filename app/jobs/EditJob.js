import React, { useEffect, useState } from 'react';
import { 
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Button,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { BASE_URL } from '../../src/config/index';
import { pickAndProcessImage, uploadImage } from '../../src/utils/imageUtils';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EditJob() {
  const router = useRouter();
  const route = useRoute();
  const { id } = route.params; // Job ID

  const [loading, setLoading] = useState(false);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [clients, setClients] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [localAttachments, setLocalAttachments] = useState([]);
  const [loadingAttachment, setLoadingAttachment] = useState(false);

  const loadJob = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${BASE_URL}/jobs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const job = data.job;
        setForm({
          client_id: job.client_id || '',
          folder_id: job.folder_id || '',
          description: job.description || '',
          job_date: job.job_date || '',
          start_time: job.start_time ? job.start_time.split(' ')[1]?.slice(0,5) || job.start_time.slice(0,5) : '',
          end_time: job.end_time ? job.end_time.split(' ')[1]?.slice(0,5) || job.end_time.slice(0,5) : '',
          tariff_id: job.tariff_id ? String(job.tariff_id) : '',
          manual_amount: job.manual_amount ? job.manual_amount.toString() : '',
          attached_files: job.attached_files || [],
        });
      } else {
        Alert.alert('Error', 'Unable to fetch job details');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadJob();
      loadClients();
      loadTariffs();
    }
  }, [id]);

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
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        Alert.alert('Success', 'Job updated');
        router.back();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error updating job');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Confirm',
      'Are you sure you want to delete this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) return;
              const response = await fetch(`${BASE_URL}/jobs/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Success', 'Job deleted');
                router.back();
              } else {
                const errData = await response.json();
                Alert.alert('Error', errData.error || 'Error deleting job');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edit Job</Text>

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
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{form.job_date || 'Select Job Date'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={form.job_date ? new Date(form.job_date) : new Date()}
          mode="date"
          display="default"
          onChange={(e, selected) => {
            setShowDatePicker(false);
            if (selected) {
              setForm(prev => ({ ...prev, job_date: selected.toISOString().split('T')[0] }));
            }
          }}
        />
      )}

      {/* Start Time */}
      <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
        <Text>{form.start_time || 'Select Start Time'}</Text>
      </TouchableOpacity>
      {showStartPicker && (
        <DateTimePicker
          value={form.start_time ? new Date(`1970-01-01T${form.start_time}`) : new Date()}
          mode="time"
          display="default"
          onChange={(e, selected) => {
            setShowStartPicker(false);
            if (selected) {
              const t = selected.toTimeString().slice(0,5);
              setForm(prev => ({ ...prev, start_time: t }));
            }
          }}
        />
      )}

      {/* End Time */}
      <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
        <Text>{form.end_time || 'Select End Time'}</Text>
      </TouchableOpacity>
      {showEndPicker && (
        <DateTimePicker
          value={form.end_time ? new Date(`1970-01-01T${form.end_time}`) : new Date()}
          mode="time"
          display="default"
          onChange={(e, selected) => {
            setShowEndPicker(false);
            if (selected) {
              const t = selected.toTimeString().slice(0,5);
              setForm(prev => ({ ...prev, end_time: t }));
            }
          }}
        />
      )}

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
        <Text style={styles.saveButtonText}>Update</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Job</Text>
      </TouchableOpacity>
      <Button title="Cancel" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  deleteButton: { 
    backgroundColor: '#FF3333', 
    padding: 15, 
    borderRadius: 10, 
    marginVertical: 10, 
    alignItems: 'center' 
  },
  deleteButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
