import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, Button, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import CircleImagePicker from '@/components/CircleImagePicker';
import { AuthContext } from '@/contexts/AuthContext';
import { ProfileContext, ProfileForm } from '@/contexts/ProfileContext';
import globalStyles from '@/styles/GlobalStyles';

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  // Ahora extraemos email desde AuthContext
  const { username, email, logout } = useContext(AuthContext);
  const { profileDetails, loadProfile, updateProfile, updateImage, deleteAccount } = useContext(ProfileContext)!;

  // Estado local del formulario solo con campos editables (sin email)
  const [editProfile, setEditProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: '',
    phone: '',
    address: '',
    cuit: '',
    profile_file_id: '',
  });

  useEffect(() => {
    void loadProfile();
  }, []);

  useEffect(() => {
    // Al cargar el perfil, rellenamos el formulario con los campos editables
    if (profileDetails) {
      setProfileForm({
        full_name: profileDetails.full_name || '',
        phone: profileDetails.phone || '',
        address: profileDetails.address || '',
        cuit: profileDetails.cuit || '',
        profile_file_id: profileDetails.profile_file_id ? profileDetails.profile_file_id.toString() : '',
      });
    }
  }, [profileDetails]);

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>Perfil</Text>

      {profileDetails ? (
        <View style={{ backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 20 }}>
          <CircleImagePicker
            fileId={profileDetails.profile_file_id}
            editable={true}
            size={200}
            onImageChange={newFileId => updateImage(newFileId, profileForm)}
          />

          <Text style={{ fontSize: 18, marginVertical: 5 }}>Username: {username}</Text>
          <Text style={{ fontSize: 18, marginVertical: 5 }}>Email: {email}</Text>

          {editProfile ? (
            <>
              <TextInput
                style={{ borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 5, backgroundColor: '#fff' }}
                value={profileForm.full_name}
                onChangeText={text => setProfileForm({ ...profileForm, full_name: text })}
                placeholder="Nombre completo"
              />
              <TextInput
                style={{ borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 5, backgroundColor: '#fff' }}
                value={profileForm.phone}
                onChangeText={text => setProfileForm({ ...profileForm, phone: text })}
                placeholder="Teléfono"
                keyboardType="phone-pad"
              />
              <TextInput
                style={{ borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 5, backgroundColor: '#fff' }}
                value={profileForm.address}
                onChangeText={text => setProfileForm({ ...profileForm, address: text })}
                placeholder="Dirección"
              />
              <TextInput
                style={{ borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 5, backgroundColor: '#fff' }}
                value={profileForm.cuit}
                onChangeText={text => setProfileForm({ ...profileForm, cuit: text })}
                placeholder="CUIT"
                keyboardType="numeric"
              />
              <Button
                title="Guardar Perfil"
                onPress={() => {
                  void updateProfile(profileForm);
                  setEditProfile(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, marginVertical: 5 }}>Nombre: {profileDetails.full_name}</Text>
              <Text style={{ fontSize: 18, marginVertical: 5 }}>Teléfono: {profileDetails.phone}</Text>
              <Text style={{ fontSize: 18, marginVertical: 5 }}>Dirección: {profileDetails.address}</Text>
              <Text style={{ fontSize: 18, marginVertical: 5 }}>CUIT: {profileDetails.cuit}</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#007BFF', borderRadius: 10, padding: 15, marginTop: 10, alignItems: 'center' }}
                onPress={() => setEditProfile(true)}
              >
                <Text style={{ color: '#fff', fontSize: 18 }}>Editar Perfil</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <Text style={{ fontSize: 18, marginVertical: 5 }}>Cargando perfil...</Text>
      )}
      <View style={globalStyles.button}>
        <Button title="Eliminar Cuenta" onPress={deleteAccount} color="red" />
      </View>
      <View style={globalStyles.button}>
        <Button title="Cerrar Sesión" onPress={logout} />
      </View>
    </ScrollView>
  );
}
