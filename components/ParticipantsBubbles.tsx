import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProfilesContext, UserProfile } from '@/contexts/ProfilesContext';
import { ProfilesListContext, Profile } from '@/contexts/ProfilesListContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';

const CAROUSEL_ITEM_WIDTH = 240;
const CAROUSEL_ITEM_MARGIN = 12;
const CAROUSEL_ARROW_GUTTER = 40;
const CAROUSEL_SNAP_INTERVAL = CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_MARGIN * 2;

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
  const carouselRef = useRef<FlatList<Profile> | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const textColor = useThemeColor({}, 'text');
  const modalBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const subtleText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const arrowBackground = useThemeColor({ light: '#e5e7eb', dark: '#1f2937' }, 'background');

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

  const maxCarouselIndex = Math.max(availableProfiles.length - 1, 0);

  const handleCarouselMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!availableProfiles.length) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_SNAP_INTERVAL);
      const clamped = Math.max(0, Math.min(index, maxCarouselIndex));
      setCarouselIndex(clamped);
    },
    [availableProfiles.length, maxCarouselIndex],
  );

  const scrollCarouselToIndex = useCallback(
    (index: number) => {
      if (!availableProfiles.length) return;
      const clamped = Math.max(0, Math.min(index, maxCarouselIndex));
      setCarouselIndex(clamped);
      const offset = clamped * CAROUSEL_SNAP_INTERVAL;
      carouselRef.current?.scrollToOffset({ offset, animated: true });
    },
    [availableProfiles.length, maxCarouselIndex],
  );

  const handleCarouselPrev = useCallback(() => {
    scrollCarouselToIndex(carouselIndex - 1);
  }, [carouselIndex, scrollCarouselToIndex]);

  const handleCarouselNext = useCallback(() => {
    scrollCarouselToIndex(carouselIndex + 1);
  }, [carouselIndex, scrollCarouselToIndex]);

  useEffect(() => {
    if (!pickerVisible) return undefined;
    setCarouselIndex(0);
    const timeout = setTimeout(() => {
      carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [pickerVisible]);

  useEffect(() => {
    if (!availableProfiles.length) {
      setCarouselIndex(0);
      const timeout = setTimeout(() => {
        carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 0);
      return () => clearTimeout(timeout);
    }
    if (carouselIndex > maxCarouselIndex) {
      const targetIndex = maxCarouselIndex;
      const timeout = setTimeout(() => {
        carouselRef.current?.scrollToOffset({
          offset: targetIndex * CAROUSEL_SNAP_INTERVAL,
          animated: false,
        });
      }, 0);
      setCarouselIndex(targetIndex);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [availableProfiles.length, maxCarouselIndex, carouselIndex]);

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
            style={[styles.carouselContainer, { backgroundColor: modalBackground }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Seleccionar participante</ThemedText>
            {availableProfiles.length ? (
              <View style={styles.carouselWrapper}>
                {availableProfiles.length > 1 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Anterior"
                    onPress={handleCarouselPrev}
                    style={[
                      styles.carouselArrow,
                      styles.carouselArrowLeft,
                      { backgroundColor: arrowBackground },
                      carouselIndex === 0 && styles.carouselArrowDisabled,
                    ]}
                    disabled={carouselIndex === 0}
                  >
                    <Ionicons name="chevron-back" size={22} color={textColor} />
                  </TouchableOpacity>
                ) : null}
                <FlatList
                  ref={carouselRef}
                  data={availableProfiles}
                  keyExtractor={item => item.id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.carousel}
                  contentContainerStyle={styles.carouselContent}
                  snapToInterval={CAROUSEL_SNAP_INTERVAL}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  disableIntervalMomentum
                  onMomentumScrollEnd={handleCarouselMomentumEnd}
                  getItemLayout={(_, index) => ({
                    length: CAROUSEL_SNAP_INTERVAL,
                    offset: CAROUSEL_SNAP_INTERVAL * index,
                    index,
                  })}
                  renderItem={({ item }) => {
                    const details = profileDetails[item.id] ?? null;
                    return (
                      <View style={styles.carouselItem}>
                        <CircleImagePicker
                          fileId={
                            details?.profile_file_id
                              ? details.profile_file_id.toString()
                              : undefined
                          }
                          size={120}
                        />
                        <ThemedText style={[styles.modalText, { color: textColor }]}>Usuario: {item.username}</ThemedText>
                        <ThemedText style={[styles.modalText, { color: textColor }]}>Email: {item.email}</ThemedText>
                        {details?.full_name ? (
                          <ThemedText style={[styles.modalText, { color: textColor }]}>Nombre: {details.full_name}</ThemedText>
                        ) : null}
                        {details?.phone ? (
                          <ThemedText style={[styles.modalText, { color: textColor }]}>Teléfono: {details.phone}</ThemedText>
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
                {availableProfiles.length > 1 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Siguiente"
                    onPress={handleCarouselNext}
                    style={[
                      styles.carouselArrow,
                      styles.carouselArrowRight,
                      { backgroundColor: arrowBackground },
                      carouselIndex >= availableProfiles.length - 1 && styles.carouselArrowDisabled,
                    ]}
                    disabled={carouselIndex >= availableProfiles.length - 1}
                  >
                    <Ionicons name="chevron-forward" size={22} color={textColor} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <ThemedText style={[styles.modalText, { color: textColor, textAlign: 'center' }]}>No hay perfiles disponibles</ThemedText>
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
  carouselContainer: {
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
    width: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  carouselWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carousel: {
    flexGrow: 0,
    width: '100%',
  },
  carouselContent: {
    alignItems: 'center',
    paddingHorizontal: CAROUSEL_ITEM_MARGIN + CAROUSEL_ARROW_GUTTER,
  },
  carouselItem: {
    width: CAROUSEL_ITEM_WIDTH,
    marginHorizontal: CAROUSEL_ITEM_MARGIN,
    alignItems: 'center',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  carouselArrowLeft: {
    left: 12,
  },
  carouselArrowRight: {
    right: 12,
  },
  carouselArrowDisabled: {
    opacity: 0.4,
  },
  selectButton: {
    marginTop: 16,
    minWidth: 140,
  },
});
