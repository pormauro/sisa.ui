import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

interface Profile {
  id: number;
  username: string;
  email: string;
  activated: number;
}

interface UserSelectorProps {
  onSelect: (user: Profile | null) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({ onSelect }) => {
  const { token } = useContext(AuthContext);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`${BASE_URL}/profiles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(data => {
        const globalOption: Profile = {
          id: 0,
          username: 'Global',
          email: '',
          activated: 1,
        };
        const fetchedProfiles = data.profiles.map((profile: any) => ({
          ...profile,
          id: Number(profile.id),
        }));
        setProfiles([globalOption, ...fetchedProfiles]);
      })
      .catch(error => {
        console.error('Error fetching profiles:', error);
      });
  }, [token]);

  const handleSelect = (profile: Profile) => {
    setSelectedProfile(profile);
    setModalVisible(false);
    onSelect(profile.id === 0 ? null : profile);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Selecciona un usuario:</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setModalVisible(true)}>
        <Text>{selectedProfile ? selectedProfile.username : 'Elegir usuario...'}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={profiles}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelect(item)} style={styles.item}>
                  <Text>{item.username}</Text>
                </Pressable>
              )}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
              <Text style={{ color: 'white' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'white',
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
