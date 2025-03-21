// app/profile.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BASE_URL } from './config/index';

// Importamos nuestro nuevo componente
import CircleImagePicker from './components/CircleImagePicker';

const Home = () => {
  const router = useRouter();

  // Datos básicos desde AsyncStorage
  const [userData, setUserData] = useState({
    user_id: null,
    username: null,
    email: null,
  });

  // Datos de la API
  const [profileDetails, setProfileDetails] = useState(null);
  const [configDetails, setConfigDetails] = useState(null);

  // Modo edición
  const [editProfile, setEditProfile] = useState(false);
  const [editConfig, setEditConfig] = useState(false);

  // Formularios
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    cuit: '',
    profile_file_id: '',
  });
  const [configForm, setConfigForm] = useState({
    role: '',
    view_type: '',
    theme: '',
    font_size: '',
  });

  // Cargar datos básicos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user_id = await AsyncStorage.getItem('user_id');
        const username = await AsyncStorage.getItem('username');
        const email = await AsyncStorage.getItem('email');
        setUserData({ user_id, username, email });
      } catch (error) {
        console.log('Error al cargar datos del usuario:', error);
      }
    };
    loadUserData();
  }, []);

  // Cargar perfil y configuración
  const loadUserDetails = async () => {
    if (userData.user_id) {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      // Obtener perfil
      try {
        const profileResponse = await fetch(
          `${BASE_URL}/user_profile/${userData.user_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profile = profileData.profile;
          setProfileDetails(profile);
          setProfileForm({
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            address: profile.address || '',
            cuit: profile.cuit || '',
            profile_file_id: profile.profile_file_id
              ? profile.profile_file_id.toString()
              : '',
          });
        } else {
          console.error('Error al obtener el perfil');
        }
      } catch (error) {
        console.error('Error en fetch de perfil:', error);
      }
      // Obtener configuración
      try {
        const configResponse = await fetch(
          `${BASE_URL}/user_configurations/${userData.user_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (configResponse.ok) {
          const configData = await configResponse.json();
          const configuration = configData.configuration;
          setConfigDetails(configuration);
          setConfigForm({
            role: configuration.role || '',
            view_type: configuration.view_type || '',
            theme: configuration.theme || '',
            font_size: configuration.font_size || '',
          });
        } else {
          console.error('Error al obtener la configuración');
        }
      } catch (error) {
        console.error('Error en fetch de configuración:', error);
      }
    }
  };

  useEffect(() => {
    loadUserDetails();
  }, [userData.user_id]);

  // Callback cuando se sube una nueva imagen de perfil
  const handleImageUpdate = async (newFileId) => {
    // Actualizamos en backend
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const updateResponse = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          address: profileForm.address,
          cuit: profileForm.cuit,
          profile_file_id: newFileId,
        }),
      });
      if (updateResponse.ok) {
        // Recargamos el perfil
        loadUserDetails();
      } else {
        const errData = await updateResponse.json();
        Alert.alert('Error', errData.error || 'Error actualizando perfil');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user_id');
      await AsyncStorage.removeItem('username');
      await AsyncStorage.removeItem('email');
      Alert.alert('Sesión cerrada');
      router.replace('./login/login');
    } catch (error) {
      console.log('Error al cerrar sesión:', error);
    }
  };

  // Guardar cambios en perfil
  const handleProfileSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          address: profileForm.address,
          cuit: profileForm.cuit,
          profile_file_id:
            profileForm.profile_file_id === ''
              ? null
              : parseInt(profileForm.profile_file_id),
        }),
      });
      if (response.ok) {
        setProfileDetails({ ...profileDetails, ...profileForm });
        setEditProfile(false);
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error actualizando perfil');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Guardar cambios en configuración
  const handleConfigSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: configForm.role,
          view_type: configForm.view_type,
          theme: configForm.theme,
          font_size: configForm.font_size,
        }),
      });
      if (response.ok) {
        setConfigDetails({ ...configDetails, ...configForm });
        setEditConfig(false);
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error actualizando configuración');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.subtitle}>
        Perfil
        <TouchableOpacity onPress={() => setEditProfile(!editProfile)}>
          <Text style={styles.editIcon}> ✏️ </Text>
        </TouchableOpacity>
      </Text>

      {profileDetails ? (
        <View style={styles.dataContainer}>
          {/* Usamos nuestro CircleImagePicker */}
          <CircleImagePicker
            fileId={profileDetails.profile_file_id}
            editable={true}
            onImageChange={handleImageUpdate}
            size={200}
          />

          <Text style={styles.infoText}>Username: {userData.username}</Text>
          <Text style={styles.infoText}>Email: {userData.email}</Text>

          {editProfile ? (
            <>
              <TextInput
                style={styles.input}
                value={profileForm.full_name}
                onChangeText={(text) =>
                  setProfileForm({ ...profileForm, full_name: text })
                }
                placeholder="Nombre completo"
              />
              <TextInput
                style={styles.input}
                value={profileForm.phone}
                onChangeText={(text) =>
                  setProfileForm({ ...profileForm, phone: text })
                }
                placeholder="Teléfono"
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                value={profileForm.address}
                onChangeText={(text) =>
                  setProfileForm({ ...profileForm, address: text })
                }
                placeholder="Dirección"
              />
              <TextInput
                style={styles.input}
                value={profileForm.cuit}
                onChangeText={(text) =>
                  setProfileForm({ ...profileForm, cuit: text })
                }
                placeholder="CUIT"
                keyboardType="numeric"
              />
              <Button title="Guardar Perfil" onPress={handleProfileSave} />
            </>
          ) : (
            <>
              <Text style={styles.infoText}>Nombre: {profileDetails.full_name}</Text>
              <Text style={styles.infoText}>Teléfono: {profileDetails.phone}</Text>
              <Text style={styles.infoText}>Dirección: {profileDetails.address}</Text>
              <Text style={styles.infoText}>CUIT: {profileDetails.cuit}</Text>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.infoText}>Cargando perfil...</Text>
      )}

      <Text style={styles.subtitle}>
        Configuración
        <TouchableOpacity onPress={() => setEditConfig(!editConfig)}>
          <Text style={styles.editIcon}> ✏️ </Text>
        </TouchableOpacity>
      </Text>

      {configDetails ? (
        <View style={styles.dataContainer}>
          {editConfig ? (
            <>
              <TextInput
                style={styles.input}
                value={configForm.role}
                onChangeText={(text) =>
                  setConfigForm({ ...configForm, role: text })
                }
                placeholder="Rol"
              />
              <TextInput
                style={styles.input}
                value={configForm.view_type}
                onChangeText={(text) =>
                  setConfigForm({ ...configForm, view_type: text })
                }
                placeholder="Tipo de vista"
              />
              <TextInput
                style={styles.input}
                value={configForm.theme}
                onChangeText={(text) =>
                  setConfigForm({ ...configForm, theme: text })
                }
                placeholder="Tema"
              />
              <TextInput
                style={styles.input}
                value={configForm.font_size}
                onChangeText={(text) =>
                  setConfigForm({ ...configForm, font_size: text })
                }
                placeholder="Tamaño de fuente"
              />
              <Button title="Guardar Configuración" onPress={handleConfigSave} />
            </>
          ) : (
            <>
              <Text style={styles.infoText}>Rol: {configDetails.role}</Text>
              <Text style={styles.infoText}>Tipo de vista: {configDetails.view_type}</Text>
              <Text style={styles.infoText}>Tema: {configDetails.theme}</Text>
              <Text style={styles.infoText}>Tamaño de fuente: {configDetails.font_size}</Text>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.infoText}>Cargando configuración...</Text>
      )}

      <Button title="Cerrar Sesión" onPress={handleLogout} />
    </ScrollView>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  dataContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  infoText: { fontSize: 18, marginVertical: 5 },
  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  editIcon: {
    fontSize: 18,
    marginLeft: 10,
    color: '#007BFF',
  },
});
