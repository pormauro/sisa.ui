// C:/Users/Mauri/Documents/GitHub/router/app/jobs/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import SchedulePicker from '@/components/SchedulePicker';
import { Picker } from '@react-native-picker/picker';
import FileCarousel from '@/components/FileCarousel';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ProductsServicesContext } from '@/contexts/ProductsServicesContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';

export default function CreateJobScreen() {
  const router = useRouter();
  const { addJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);
  const { productsServices } = useContext(ProductsServicesContext);
  const { statuses, loadStatuses } = useContext(StatusesContext);

  // Form state
  const [selectedClient, setSelectedClient]   = useState<string>('');
  const [selectedFolder, setSelectedFolder]   = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedStatus, setSelectedStatus]   = useState<ModalPickerItem | null>(null);
  const [typeOfWork, setTypeOfWork]           = useState<string>('');
  const [description, setDescription]         = useState<string>('');
  const [multiplicativeValue, setMultiplicativeValue] = useState<string>('1.00');
  const [attachedFiles, setAttachedFiles]     = useState<string>('');
  const [scheduleJson, setScheduleJson]       = useState<string | null>(null);
  const [loading, setLoading]                 = useState<boolean>(false);

  useEffect(() => {
    if (!permissions.includes('addJob')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar trabajos.');
      router.back();
    }
    loadStatuses();
  }, [permissions]);

  const filteredFolders = useMemo(() => {
    if (!selectedClient) return [];
    const cid = parseInt(selectedClient, 10);
    return folders.filter(f => f.client_id === cid);
  }, [folders, selectedClient]);

  const statusItems: ModalPickerItem[] = useMemo(
    () => statuses.map((s: Status) => ({
      id: s.id,
      name: s.label,
      backgroundColor: s.background_color,
    })),
    [statuses]
  );

  const handleSubmit = async () => {
    if (!selectedClient || !selectedStatus) {
      Alert.alert('Error', 'Completa Cliente y Estado obligatorios.');
      return;
    }
    const jobData = {
      client_id: Number.parseInt(selectedClient, 10),
      folder_id: selectedFolder ? parseInt(selectedFolder, 10) : null,
      product_service_id: selectedProduct ? parseInt(selectedProduct, 10) : null,
      type_of_work: typeOfWork,
      description,
      status: selectedStatus.id.toString(),
      schedule: scheduleJson,
      multiplicative_value: parseFloat(multiplicativeValue),
      attached_files: attachedFiles || null,
    };
    setLoading(true);
    const created = await addJob(jobData);
    setLoading(false);

    if (created) {
      Alert.alert('Éxito', 'Trabajo creado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el trabajo.');
    }
  };

  // Aquí renderizamos TODO el formulario como header de la FlatList
  const renderHeader = () => (
    <View>
      {/* Estado */}
      <Text style={styles.label}>Estado *</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={statusItems}
          selectedItem={selectedStatus}
          onSelect={setSelectedStatus}
          placeholder="-- Selecciona un Estado --"
        />
      </View>

      {/* Tipo de trabajo */}
      <Text style={styles.label}>Tipo de trabajo</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Reparación de equipo"
        value={typeOfWork}
        onChangeText={setTypeOfWork}
      />

      {/* Descripción */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Describe este trabajo"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Cliente */}
      <Text style={styles.label}>Cliente *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedClient}
          onValueChange={setSelectedClient}
          style={styles.picker}
        >
          <Picker.Item label="-- Selecciona Cliente --" value="" />
          {clients.map(c => (
            <Picker.Item key={c.id} label={c.business_name} value={c.id.toString()} />
          ))}
        </Picker>
      </View>

      {/* Carpeta */}
      <Text style={styles.label}>Carpeta</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedFolder}
          onValueChange={setSelectedFolder}
          enabled={!!selectedClient}
          style={styles.picker}
        >
          <Picker.Item label="-- Sin carpeta --" value="" />
          {filteredFolders.map(f => (
            <Picker.Item key={f.id} label={f.name} value={f.id.toString()} />
          ))}
        </Picker>
      </View>

      {/* Producto/Servicio */}
      <Text style={styles.label}>Producto/Servicio</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedProduct}
          onValueChange={setSelectedProduct}
          style={styles.picker}
        >
          <Picker.Item label="-- Ninguno --" value="" />
          {productsServices.map(ps => (
            <Picker.Item key={ps.id} label={ps.description} value={ps.id.toString()} />
          ))}
        </Picker>
      </View>

      {/* Horarios */}
      <Text style={styles.label}>Horario trabajado</Text>
      <SchedulePicker
        initialDataJson={scheduleJson || undefined}
        onChange={setScheduleJson}
      />

      {/* Archivos adjuntos */}
      <Text style={styles.label}>Archivos adjuntos</Text>
      <FileCarousel filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} />
    </View>
  );

  // Como no tenemos datos de lista, pasamos un array vacío.
  return (
    <FlatList
      data={[]}
      keyExtractor={() => 'none'}
      renderItem={null}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={() => (
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Crear Trabajo</Text>
          }
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginTop: 12, fontSize: 16, fontWeight: '600' },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginVertical: 8,
  },
  picker: { height: 50, width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
