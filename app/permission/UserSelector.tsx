import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

export interface Profile {
  id: number;
  username: string;
  email: string;
  activated: number;
}

interface UserSelectorProps {
  onSelect: (user: Profile | null) => void;
  includeGlobal?: boolean;
  filterProfiles?: (profile: Profile) => boolean;
}

const UserSelector: React.FC<UserSelectorProps> = ({ onSelect, includeGlobal = true, filterProfiles }) => {
  const { token } = useContext(AuthContext);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const globalOption: Profile = {
      id: 0,
      username: 'Global',
      email: '',
      activated: 1,
    };

    const fallbackProfiles = includeGlobal ? [globalOption] : [];

    const loadProfiles = async () => {
      try {
        const response = await fetch(`${BASE_URL}/profiles`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Error fetching profiles: HTTP ${response.status}${errorText ? ` - ${errorText}` : ''}`
          );
          Alert.alert(
            'No se pudieron cargar los usuarios',
            'Verificá que tengas permisos para listar perfiles o reintentá en unos instantes.'
          );
          setProfiles(fallbackProfiles);
          return;
        }

        const data = await response.json();
        const rawProfiles = Array.isArray(data?.profiles) ? data.profiles : [];
        const fetchedProfiles: Profile[] = rawProfiles
          .map((profile: any) => ({
            ...profile,
            id: Number(profile.id),
          }))
          .filter((profile: Profile) => (filterProfiles ? filterProfiles(profile) : true));

        const options = includeGlobal ? [globalOption, ...fetchedProfiles] : fetchedProfiles;
        setProfiles(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Error fetching profiles:', error);
        Alert.alert(
          'No se pudieron cargar los usuarios',
          'Revisá tu conexión o permisos e intenta nuevamente.'
        );
        setProfiles(fallbackProfiles);
      }
    };

    void loadProfiles();

    return () => {
      controller.abort();
    };
  }, [token, includeGlobal, filterProfiles]);

  const handleSelect = (profile: Profile) => {
    setSelectedProfile(profile);
    setModalVisible(false);
    onSelect(profile.id === 0 ? null : profile);
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Selecciona un usuario:</ThemedText>
      <TouchableOpacity style={[styles.selector, { borderColor }]} onPress={() => setModalVisible(true)}>
        <ThemedText>{selectedProfile ? selectedProfile.username : 'Elegir usuario...'}</ThemedText>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent} lightColor="#fff" darkColor="#1e1e1e">
            <FlatList
              data={profiles}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelect(item)} style={styles.item}>
                  <ThemedText>{item.username}</ThemedText>
                </Pressable>
              )}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
              <ThemedText style={{ color: 'white' }}>Cancelar</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  selector: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
  },
  modalContent: {
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 10,
    maxHeight: '70%',
  },
  item: {
    paddingVertical: 10,
  },
  cancelButton: {
    marginTop: 10,
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  }
});

export default UserSelector;
