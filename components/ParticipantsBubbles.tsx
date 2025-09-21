import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProfilesContext, UserProfile } from '@/contexts/ProfilesContext';
import { ProfilesListContext, Profile } from '@/contexts/ProfilesListContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ParticipantsBubblesProps {
  participants: number[];
  onChange?: (ids: number[]) => void;
  editable?: boolean;
}

interface ParticipantItem {
  id: number;
  fileId: number | null;
}

export default function ParticipantsBubbles({ participants, onChange, editable = true }: ParticipantsBubblesProps) {
  const { getProfile } = useContext(ProfilesContext);
  const { profiles, loadProfiles } = useContext(ProfilesListContext);
  const [items, setItems] = useState<ParticipantItem[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedListProfile, setSelectedListProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [profileDetails, setProfileDetails] = useState<Record<number, UserProfile | null>>({});

  const textColor = useThemeColor({}, 'text');
  const modalBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const subtleText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const cardBackground = useThemeColor({ light: '#f9fafb', dark: '#1f2937' }, 'background');
  const cardBorder = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');

  useEffect(() => {
    if (!profiles.length) {
      void loadProfiles();
    }
  }, [profiles.length, loadProfiles]);

  useEffect(() => {
    const load = async () => {
      const list: ParticipantItem[] = [];
      const detailBatch: Record<number, UserProfile | null> = {};
      for (const id of participants) {
        const profile = await getProfile(id);
        list.push({ id, fileId: profile?.profile_file_id ?? null });
        detailBatch[id] = profile ?? null;
      }
      setItems(list);
      if (Object.keys(detailBatch).length) {
        setProfileDetails(prev => ({ ...prev, ...detailBatch }));
      }
    };
    void load();
  }, [participants, getProfile]);

  const availableProfiles = useMemo(
    () => profiles.filter(profile => !items.some(it => it.id === profile.id)),
    [profiles, items],
  );

  useEffect(() => {
    if (!pickerVisible) return;
    const loadDetails = async () => {
      const updates: Record<number, UserProfile | null> = {};
      for (const profile of availableProfiles) {
        if (Object.prototype.hasOwnProperty.call(profileDetails, profile.id)) {
          continue;
        }
        const detail = await getProfile(profile.id);
        updates[profile.id] = detail ?? null;
      }
      if (Object.keys(updates).length) {
        setProfileDetails(prev => ({ ...prev, ...updates }));
      }
    };
    void loadDetails();
  }, [pickerVisible, availableProfiles, profileDetails, getProfile]);

  const handleRemove = (id: number) => {
    if (!editable) return;
    const updated = items.filter(it => it.id !== id);
    setItems(updated);
    onChange?.(updated.map(it => it.id));
  };

  const handleSelectProfile = async (id: number) => {
    if (!editable) return;
    if (items.some(it => it.id === id)) {
      setPickerVisible(false);
      return;
    }
    const profile = await getProfile(id);
    const updated = [...items, { id, fileId: profile?.profile_file_id ?? null }];
    setItems(updated);
    onChange?.(updated.map(it => it.id));
    setProfileDetails(prev => ({ ...prev, [id]: profile ?? null }));
    setPickerVisible(false);
  };

  const openProfile = async (id: number) => {
    const details = await getProfile(id);
    const listProfile = profiles.find(p => p.id === id) || null;
    if (details) {
      setSelectedProfile(details);
      setSelectedListProfile(listProfile);
      setModalVisible(true);
    }
  };

  const closeProfile = () => {
    setModalVisible(false);
    setSelectedProfile(null);
    setSelectedListProfile(null);
  };

  const renderItem = ({ item }: { item: ParticipantItem }) => (
    <TouchableOpacity style={styles.bubble} onPress={() => openProfile(item.id)}>
      <CircleImagePicker fileId={item.fileId ? item.fileId.toString() : undefined} size={50} />
    </TouchableOpacity>
  );

  const addBubble = editable ? (
    <TouchableOpacity style={styles.bubble} onPress={() => setPickerVisible(true)}>
      <View style={[styles.plusBubble, { borderColor: accentColor }]}>
        <Text style={[styles.plusText, { color: accentColor }]}>+</Text>
      </View>
    </TouchableOpacity>
  ) : null;

  return (
    <View>
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => it.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsHorizontalScrollIndicator={false}
        ListFooterComponent={addBubble}
      />
      {!items.length && !editable ? (
        <ThemedText style={[styles.emptyText, { color: subtleText }]}>Sin participantes</ThemedText>
      ) : null}
      {selectedProfile && (
        <Modal visible={modalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={closeProfile}>
            <Pressable
              style={[styles.modalContainer, { backgroundColor: modalBackground }]}
              onPress={(e) => e.stopPropagation()}
            >
              <CircleImagePicker
                fileId={
                  selectedProfile.profile_file_id
                    ? selectedProfile.profile_file_id.toString()
                    : undefined
                }
                size={150}
              />
              {selectedListProfile && (
                <>
                  <ThemedText style={[styles.modalText, { color: textColor }]}>Usuario: {selectedListProfile.username}</ThemedText>
                  <ThemedText style={[styles.modalText, { color: textColor }]}>Email: {selectedListProfile.email}</ThemedText>
                </>
              )}
              <ThemedText style={[styles.modalText, { color: textColor }]}>Nombre: {selectedProfile.full_name}</ThemedText>
              {selectedProfile.phone ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>Teléfono: {selectedProfile.phone}</ThemedText>
              ) : null}
              {selectedProfile.address ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>Dirección: {selectedProfile.address}</ThemedText>
              ) : null}
              {selectedProfile.cuit ? (
                <ThemedText style={[styles.modalText, { color: textColor }]}>CUIT: {selectedProfile.cuit}</ThemedText>
              ) : null}
              {editable ? (
                <ThemedButton
                  title="Eliminar"
                  onPress={() => {
                    handleRemove(selectedProfile.id);
                    closeProfile();
                  }}
                  style={styles.removeButton}
                />
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      )}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable
            style={[styles.selectorContainer, { backgroundColor: modalBackground }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Seleccionar participante</ThemedText>
            <ThemedText style={[styles.modalDescription, { color: subtleText }]}>Elige a la persona que deseas asignar desde la lista.</ThemedText>
            {availableProfiles.length ? (
              <FlatList
                data={availableProfiles}
                keyExtractor={(item) => item.id.toString()}
                style={styles.selectorList}
                contentContainerStyle={styles.selectorListContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const details = profileDetails[item.id] ?? null;
                  return (
                    <View
                      style={[
                        styles.profileCard,
                        { backgroundColor: cardBackground, borderColor: cardBorder },
                      ]}
                    >
                      <View style={styles.profileHeader}>
                        <CircleImagePicker
                          fileId={
                            details?.profile_file_id
                              ? details.profile_file_id.toString()
                              : undefined
                          }
                          size={64}
                        />
                        <View style={styles.profileInfo}>
                          <ThemedText
                            style={[styles.profileName, { color: textColor }]}
                            numberOfLines={1}
                          >
                            {details?.full_name ?? item.username}
                          </ThemedText>
                          <ThemedText
                            style={[styles.profileMeta, { color: subtleText }]}
                            numberOfLines={1}
                          >
                            Usuario: {item.username}
                          </ThemedText>
                          <ThemedText
                            style={[styles.profileMeta, { color: subtleText }]}
                            numberOfLines={1}
                          >
                            Email: {item.email}
                          </ThemedText>
                        </View>
                      </View>
                      {(details?.phone || details?.address || details?.cuit) ? (
                        <View style={styles.profileExtra}>
                          {details?.phone ? (
                            <ThemedText
                              style={[styles.profileMeta, { color: subtleText }]}
                              numberOfLines={1}
                            >
                              Teléfono: {details.phone}
                            </ThemedText>
                          ) : null}
                          {details?.address ? (
                            <ThemedText
                              style={[styles.profileMeta, { color: subtleText }]}
                              numberOfLines={2}
                            >
                              Dirección: {details.address}
                            </ThemedText>
                          ) : null}
                          {details?.cuit ? (
                            <ThemedText
                              style={[styles.profileMeta, { color: subtleText }]}
                              numberOfLines={1}
                            >
                              CUIT: {details.cuit}
                            </ThemedText>
                          ) : null}
                        </View>
                      ) : null}
                      <ThemedButton
                        title="Seleccionar"
                        onPress={() => handleSelectProfile(item.id)}
                        style={styles.selectButton}
                      />
                    </View>
                  );
                }}
              />
            ) : (
              <ThemedText style={[styles.modalEmptyText, { color: subtleText }]}>No hay perfiles disponibles</ThemedText>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: 8 },
  listContent: {
    alignItems: 'center',
    paddingRight: 8,
  },
  bubble: { marginRight: 8 },
  plusBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusText: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    maxWidth: '80%',
  },
  modalText: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  removeButton: {
    marginTop: 16,
  },
  selectorContainer: {
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
    width: '90%',
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  selectorList: {
    width: '100%',
  },
  selectorListContent: {
    paddingBottom: 8,
  },
  profileCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    marginTop: 2,
  },
  profileExtra: {
    marginTop: 12,
  },
  modalEmptyText: {
    textAlign: 'center',
    marginTop: 24,
  },
  selectButton: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
});
