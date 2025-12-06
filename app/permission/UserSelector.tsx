import React, { useEffect, useState, useContext, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AuthContext } from '@/contexts/AuthContext';
import { CompanyMembershipsContext } from '@/contexts/CompanyMembershipsContext';
import { useCompanyScope } from '@/contexts/CompanyScopeContext';
import { ProfilesContext } from '@/contexts/ProfilesContext';
import type { CompanyMembership } from '@/contexts/CompanyMembershipsContext';

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
  const { selectedCompanyId } = useCompanyScope();
  const { loadMemberships } = useContext(CompanyMembershipsContext);
  const { profiles: cachedProfiles, getProfile } = useContext(ProfilesContext);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  const globalOption = useMemo<Profile>(
    () => ({ id: 0, username: 'Global', email: '', activated: 1 }),
    [],
  );

  const isPrivilegedRole = (membership: CompanyMembership) => {
    const normalizedRole = membership.role?.trim().toLowerCase();
    return (
      normalizedRole === 'owner' ||
      normalizedRole === 'admin' ||
      normalizedRole === 'administrator'
    );
  };

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      if (!token) return;

      setLoading(true);
      try {
        const memberships = selectedCompanyId
          ? await loadMemberships(selectedCompanyId, 'approved')
          : [];

        const filteredMemberships = memberships.filter(
          membership => membership.status === 'approved' && !isPrivilegedRole(membership),
        );

        const uniqueUserIds = Array.from(
          new Set(filteredMemberships.map(membership => membership.user_id).filter(Boolean)),
        );

        const resolvedProfiles = await Promise.all(
          uniqueUserIds.map(async userId => {
            const profile = cachedProfiles[userId] ?? (await getProfile(userId));
            return {
              id: userId,
              username: profile?.full_name?.trim()?.length
                ? profile.full_name.trim()
                : `Usuario #${userId}`,
              email: profile?.cuit ?? '',
              activated: 1,
            } satisfies Profile;
          }),
        );

        const membershipProfiles = filterProfiles
          ? resolvedProfiles.filter(filterProfiles)
          : resolvedProfiles;

        if (!isMounted) return;

        const options = includeGlobal
          ? [globalOption, ...membershipProfiles]
          : membershipProfiles;
        setAvailableProfiles(options);
      } catch (error) {
        console.error('Error fetching company members for selector:', error);
        if (isMounted) {
          setAvailableProfiles(includeGlobal ? [globalOption] : []);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadMembers();

    return () => {
      isMounted = false;
    };
  }, [
    token,
    includeGlobal,
    filterProfiles,
    loadMemberships,
    selectedCompanyId,
    cachedProfiles,
    getProfile,
    globalOption,
  ]);

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
            {loading ? (
              <View style={styles.loaderWrapper}>
                <ActivityIndicator size="small" color={spinnerColor} />
              </View>
            ) : (
              <FlatList
                data={availableProfiles}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable onPress={() => handleSelect(item)} style={styles.item}>
                    <ThemedText>{item.username}</ThemedText>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <ThemedText style={styles.emptyState}>No hay miembros disponibles.</ThemedText>
                }
              />
            )}
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
  loaderWrapper: {
    paddingVertical: 12,
  },
  emptyState: {
    paddingVertical: 12,
    textAlign: 'center',
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
