// app/profile.js (o app/profile/index.js)

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
import { BASE_URL } from '../src/config/index';

import CircleImagePicker from '../src/components/CircleImagePicker';

export default function ProfileScreen() {
  const router = useRouter();

  // Datos básicos del usuario
  const [userData, setUserData] = useState({
    user_id: null,
    username: null,
    email: null,
  });

  // Datos de perfil
  const [profileDetails, setProfileDetails] = useState(null);

  // Modo edición
  const [editProfile, setEditProfile] = useState(false);

  // Formulario para editar
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    cuit: '',
    profile_file_id: '',
  });

  // Cargar datos básicos (user_id, username, email) de AsyncStorage
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

  // Cargar perfil desde la API
  const loadProfile = async () => {
    if (!userData.user_id) return;
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    try {
      const profileResponse = await fetch(
        `${BASE_URL}/user_profile/${userData.user_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const profile = profileData.profile;
        setProfileDetails(profile);
        // Llenamos el formulario
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
  };

  useEffect(() => {
    loadProfile();
  }, [userData.user_id]);

  // Callback al cambiar la imagen (subir nueva foto)
  const handleImageUpdate = async (newFileId) => {
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
        loadProfile(); // Recargamos datos de perfil
      } else {
        const errData = await updateResponse.json();
        Alert.alert('Error', errData.error || 'Error actualizando perfil');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Guardar cambios en perfil (PUT)
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
        // Actualizamos localmente
        if (profileDetails) {
          setProfileDetails({ ...profileDetails, ...profileForm });
        }
        setEditProfile(false);
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error actualizando perfil');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Cerrar sesión
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

  //Elimina la Cuenta
  const handleDeleteAccount = async () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción es irreversible. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;
            try {
              const response = await fetch(`${BASE_URL}/users/${userData.user_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
  
              if (response.ok) {
                await AsyncStorage.clear();
                Alert.alert('Cuenta eliminada');
                router.replace('./login');
              } else {
                Alert.alert('Error', 'No se pudo eliminar la cuenta.');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };
  

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.subtitle}>Perfil</Text>

      {profileDetails ? (
        <View style={styles.dataContainer}>
          {/* Foto en círculo editable */}
          <CircleImagePicker
            fileId={profileDetails.profile_file_id}
            editable={true}
            size={200}
            onImageChange={handleImageUpdate}
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

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditProfile(true)}
              >
                <Text style={styles.editButtonText}>Editar Perfil</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.infoText}>Cargando perfil...</Text>
      )}
      <Button title="Eliminar Cuenta" onPress={handleDeleteAccount} color="red" />
      <Button title="Cerrar Sesión" onPress={handleLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
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
    marginVertical: 8,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  editButton: {
    backgroundColor: '#007BFF',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
  },
});
