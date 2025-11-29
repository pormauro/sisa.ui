import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import CircleImagePicker from '@/components/CircleImagePicker';
import { AuthContext } from '@/contexts/AuthContext';
import { ProfileContext, ProfileForm } from '@/contexts/ProfileContext';
import globalStyles from '@/styles/GlobalStyles';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ProfileScreen(): JSX.Element {
  // Ahora extraemos email desde AuthContext
  const { username, email, logout } = useContext(AuthContext);
  const { profileDetails, loadProfile, updateProfile, updateImage, deleteAccount } = useContext(ProfileContext)!;
  const router = useRouter();

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

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderTextColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const linkColor = useThemeColor({}, 'tint');
  const dangerLinkColor = useThemeColor({ light: '#d9534f', dark: '#ff6b6b' }, 'tint');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ThemedText style={styles.subtitle}>Perfil</ThemedText>

      {profileDetails ? (
        <ThemedView style={styles.dataContainer} lightColor="#f5f5f5" darkColor="#1e1e1e">
          <CircleImagePicker
            fileId={profileDetails.profile_file_id}
            editable={true}
            size={200}
            onImageChange={(newFileId) => updateImage(newFileId, profileForm)}
          />

          <ThemedText style={styles.infoText}>Username: {username}</ThemedText>
          <ThemedText style={styles.infoText}>Email: {email}</ThemedText>

          {editProfile ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                value={profileForm.full_name}
                onChangeText={(text) => setProfileForm({ ...profileForm, full_name: text })}
                placeholder="Nombre completo"
                placeholderTextColor={placeholderTextColor}
              />
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                value={profileForm.phone}
                onChangeText={(text) => setProfileForm({ ...profileForm, phone: text })}
                placeholder="Teléfono"
                placeholderTextColor={placeholderTextColor}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                value={profileForm.address}
                onChangeText={(text) => setProfileForm({ ...profileForm, address: text })}
                placeholder="Dirección"
                placeholderTextColor={placeholderTextColor}
              />
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                value={profileForm.cuit}
                onChangeText={(text) => setProfileForm({ ...profileForm, cuit: text })}
                placeholder="CUIT"
                placeholderTextColor={placeholderTextColor}
                keyboardType="numeric"
              />
              <ThemedButton
                title="Guardar Perfil"
                onPress={() => {
                  void updateProfile(profileForm);
                  setEditProfile(false);
                }}
              />
            </>
          ) : (
            <>
              <ThemedText style={styles.infoText}>Nombre: {profileDetails.full_name}</ThemedText>
              <ThemedText style={styles.infoText}>Teléfono: {profileDetails.phone}</ThemedText>
              <ThemedText style={styles.infoText}>Dirección: {profileDetails.address}</ThemedText>
              <ThemedText style={styles.infoText}>CUIT: {profileDetails.cuit}</ThemedText>
              <ThemedButton title="Editar Perfil" onPress={() => setEditProfile(true)} style={styles.editButton} />
            </>
          )}
        </ThemedView>
      ) : (
        <ThemedText style={styles.infoText}>Cargando perfil...</ThemedText>
      )}
      <TouchableOpacity
        style={styles.deleteLink}
        onPress={deleteAccount}
        accessibilityRole="button"
        accessibilityLabel="Eliminar cuenta"
      >
        <ThemedText style={[styles.deleteLinkText, { color: dangerLinkColor }]}>Eliminar cuenta</ThemedText>
      </TouchableOpacity>
      <View style={globalStyles.button}>
        <ThemedButton title="Cerrar Sesión" onPress={logout} />
      </View>
      <TouchableOpacity
        style={styles.settingsLink}
        onPress={() => router.push('/user/ConfigScreen')}
        accessibilityRole="button"
        accessibilityLabel="Ir a ajustes"
      >
        <ThemedText style={[styles.settingsLinkText, { color: linkColor }]}>Ir a ajustes</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 120 },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dataContainer: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: { fontSize: 18, marginVertical: 5 },
  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 8,
    borderRadius: 5,
    fontSize: 16,
  },
  editButton: { marginTop: 10 },
  deleteLink: {
    marginTop: 10,
    alignItems: 'center',
  },
  deleteLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  settingsLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
