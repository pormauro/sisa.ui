import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { CircleImagePicker } from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useCompanies } from '@/contexts/CompaniesContext';
import { useThemeColor } from '@/hooks/useThemeColor';

interface MenuEntry {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isActive?: boolean;
}

const CompanySelectorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
}> = ({ visible, onClose, onSelect }) => {
  const { companies, loadCompanies, selectedCompanyId } = useCompanies();
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (!companies.length) {
      loadCompanies();
    }
  }, [companies.length, loadCompanies]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: `${textColor}99` }]}>
        <View style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Selecciona una empresa</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={tintColor} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={companies}
            keyExtractor={item => item.id.toString()}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isSelected = selectedCompanyId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.companyRow, isSelected && { borderColor: tintColor }]}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <CircleImagePicker fileId={item.profile_file_id} size={44} editable={false} />
                  <View style={styles.companyDetails}>
                    <ThemedText style={styles.companyName}>{item.name}</ThemedText>
                    {item.legal_name ? (
                      <ThemedText style={styles.companySubtitle}>{item.legal_name}</ThemedText>
                    ) : null}
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={22} color={tintColor} /> : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No hay empresas disponibles.</ThemedText>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export const BottomCompanyMenu: React.FC = () => {
  const router = useRouter();
  const { selectedCompany, selectCompany } = useCompanies();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const iconForeground = useThemeColor({ light: '#FFFFFF', dark: '#1b1327' }, 'text');
  const darkBackground = useThemeColor({ light: '#1d1a27', dark: '#0c0714' }, 'background');

  const entries: MenuEntry[] = useMemo(
    () => [
      {
        key: 'home',
        label: 'Inicio',
        icon: 'home',
        onPress: () => router.push('/Home'),
      },
      {
        key: 'notifications',
        label: 'Notificaciones',
        icon: 'notifications-outline',
        onPress: () => router.push('/notifications'),
      },
      {
        key: 'companies',
        label: selectedCompany?.name ?? 'Empresas',
        icon: 'business',
        onPress: () => setModalVisible(true),
        isActive: Boolean(selectedCompany),
      },
      {
        key: 'profile',
        label: 'Perfil',
        icon: 'person-outline',
        onPress: () => router.push('/user/ProfileScreen'),
      },
      {
        key: 'shortcuts',
        label: 'Atajos',
        icon: 'flash-outline',
        onPress: () => router.push('/shortcuts/payment_templates'),
      },
    ],
    [router, selectedCompany]
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.darkBar, { backgroundColor: darkBackground }]} />
      <View style={styles.menuContainer}>
        {entries.map(entry => {
          const isCompany = entry.key === 'companies';
          return (
            <View key={entry.key} style={styles.menuItem}>
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  isCompany ? styles.companyButton : null,
                  { backgroundColor: entry.isActive ? tintColor : '#ffffff', borderColor: tintColor },
                ]}
                onPress={entry.onPress}
                activeOpacity={0.8}
              >
                {isCompany && selectedCompany?.profile_file_id ? (
                  <CircleImagePicker fileId={selectedCompany.profile_file_id} size={48} editable={false} />
                ) : (
                  <Ionicons
                    name={entry.icon}
                    size={24}
                    color={entry.isActive ? iconForeground : textColor}
                  />
                )}
              </TouchableOpacity>
              <ThemedText
                style={[
                  styles.menuLabel,
                  entry.isActive ? { color: tintColor, fontWeight: '700' } : { color: textColor },
                ]}
                numberOfLines={1}
              >
                {entry.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <CompanySelectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelect={selectCompany}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  darkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
  },
  menuContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 12,
    width: '100%',
    paddingHorizontal: 18,
  },
  menuItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  companyButton: {
    width: 78,
    height: 78,
    borderRadius: 24,
    marginTop: -8,
  },
  menuLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalContent: {
    borderRadius: 18,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  separator: {
    height: 12,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  companyDetails: {
    flex: 1,
    marginHorizontal: 10,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  companySubtitle: {
    fontSize: 13,
    color: '#7b7b7b',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
});

export default BottomCompanyMenu;
