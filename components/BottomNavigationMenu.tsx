import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import CircleImagePicker from '@/components/CircleImagePicker';
import { useThemeColor } from '@/hooks/useThemeColor';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { CompaniesContext, type Company } from '@/contexts/CompaniesContext';
import { useSelectedCompany } from '@/contexts/SelectedCompanyContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

const MENU_HEIGHT = 108;

interface CompanyItemProps {
  company: Company;
  onSelect: (company: Company) => void;
  highlightColor: string;
  textColor: string;
  dividerColor: string;
  showDivider: boolean;
}

const CompanyItem = ({
  company,
  onSelect,
  highlightColor,
  textColor,
  dividerColor,
  showDivider,
}: CompanyItemProps) => (
  <TouchableOpacity style={styles.companyItem} onPress={() => onSelect(company)}>
    <View style={styles.companyAvatarWrapper}>
      {company.profile_file_id ? (
        <CircleImagePicker fileId={String(company.profile_file_id)} size={44} editable={false} />
      ) : (
        <View style={[styles.companyFallback, { backgroundColor: highlightColor }]}>
          <Ionicons name="business" size={22} color="#fff" />
        </View>
      )}
    </View>
    <View style={styles.companyTextBlock}>
      <ThemedText style={[styles.companyName, { color: textColor }]} numberOfLines={1}>
        {company.name || company.legal_name || 'Empresa sin nombre'}
      </ThemedText>
      {company.tax_id ? (
        <ThemedText style={styles.companyMeta} numberOfLines={1}>
          CUIT: {company.tax_id}
        </ThemedText>
      ) : null}
    </View>
    {showDivider ? <View style={[styles.companyDivider, { borderBottomColor: dividerColor }]} /> : null}
  </TouchableOpacity>
);

export const BottomNavigationMenu: React.FC = () => {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { notifications, loadNotifications } = useContext(NotificationsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { selectedCompany, selectCompany } = useSelectedCompany();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const [modalVisible, setModalVisible] = useState(false);
  const hasPrefetchedCompanies = useRef(false);

  const backdropColor = useThemeColor({ light: '#1f1928', dark: '#0f0a17' }, 'background');
  const surfaceColor = useThemeColor({ light: '#fefefe', dark: '#2b2433' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({ light: '#161616', dark: '#fefefe' }, 'text');
  const mutedTextColor = useThemeColor({ light: '#7a7383', dark: '#a19cad' }, 'text');
  const highlightColor = useThemeColor({}, 'tint');
  const dividerColor = useThemeColor({ light: '#e3e3e7', dark: '#3a3440' }, 'background');

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.state.is_read && !item.state.is_hidden).length,
    [notifications],
  );

  const canListNotifications = useMemo(
    () => userId === '1' || permissions.includes('listNotifications'),
    [permissions, userId],
  );

  useEffect(() => {
    if (!hasPrefetchedCompanies.current) {
      hasPrefetchedCompanies.current = true;
      void loadCompanies();
    }
  }, [loadCompanies]);

  useEffect(() => {
    if (modalVisible) {
      void loadCompanies();
    }
  }, [loadCompanies, modalVisible]);

  useEffect(() => {
    if (canListNotifications && notifications.length === 0) {
      void loadNotifications({ status: 'unread', limit: 25 });
    }
  }, [canListNotifications, loadNotifications, notifications.length]);

  const handleCompanySelect = (company: Company | null) => {
    selectCompany(company ? company.id : null);
    setModalVisible(false);
  };

  const renderNavButton = (
    key: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    badge?: number,
  ) => (
    <TouchableOpacity style={styles.navItem} onPress={onPress} key={key}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={24} color={iconColor} />
        {badge && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: highlightColor }]}>
            <ThemedText lightColor="#fff" darkColor="#fff" style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.navLabel, { color: textColor }]}>{label}</ThemedText>
    </TouchableOpacity>
  );

  const renderCompanyButton = () => (
    <TouchableOpacity
      style={styles.companyTrigger}
      onPress={() => setModalVisible(true)}
      accessibilityRole="button"
      accessibilityLabel="Seleccionar empresa"
    >
      <View style={[styles.companyTriggerAvatar, { borderColor: highlightColor }]}>
        {selectedCompany?.profile_file_id ? (
          <CircleImagePicker
            fileId={String(selectedCompany.profile_file_id)}
            size={52}
            editable={false}
            style={styles.companyTriggerImage}
          />
        ) : (
          <View style={[styles.companyTriggerPlaceholder, { backgroundColor: highlightColor }]}>
            <Ionicons name="business" size={26} color="#fff" />
          </View>
        )}
      </View>
      <ThemedText style={[styles.companyTriggerLabel, { color: textColor }]} numberOfLines={1}>
        {selectedCompany?.name || selectedCompany?.legal_name || 'Empresas'}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { height: MENU_HEIGHT + bottom }]}> 
      <View
        pointerEvents="none"
        style={[styles.backdrop, { backgroundColor: backdropColor, top: MENU_HEIGHT / 2 }]}
      />
      <View style={[styles.container, { backgroundColor: surfaceColor, paddingBottom: bottom + 12 }]}>
        {renderNavButton('home', 'Inicio', 'home', () => router.replace('/Home'))}
        {renderNavButton(
          'notifications',
          'Notificaciones',
          'notifications-outline',
          () => router.push('/notifications'),
          canListNotifications ? unreadCount : undefined,
        )}
        {renderCompanyButton()}
        {renderNavButton('profile', 'Perfil', 'person-outline', () => router.push('/user/ProfileScreen'))}
        {renderNavButton('shortcuts', 'Atajos', 'flash-outline', () =>
          router.push('/shortcuts/payment_templates')
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: surfaceColor }]}>
                <View style={styles.modalHeader}>
                  <ThemedText style={[styles.modalTitle, { color: textColor }]}>Empresas</ThemedText>
                  <TouchableOpacity onPress={() => handleCompanySelect(null)}>
                    <ThemedText style={{ color: highlightColor }}>Limpiar selección</ThemedText>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={companies}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item, index }) => (
                    <CompanyItem
                      company={item}
                      onSelect={handleCompanySelect}
                      highlightColor={highlightColor}
                      textColor={textColor}
                      dividerColor={dividerColor}
                      showDivider={index < companies.length - 1}
                    />
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                      <ThemedText style={{ color: mutedTextColor }}>
                        No hay empresas disponibles
                      </ThemedText>
                    </View>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    marginHorizontal: 16,
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyTrigger: {
    alignItems: 'center',
    flex: 1.2,
    gap: 6,
  },
  companyTriggerAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  companyTriggerImage: {
    alignSelf: 'center',
  },
  companyTriggerPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyTriggerLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    borderRadius: 18,
    maxHeight: '70%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  companyAvatarWrapper: {
    width: 52,
    alignItems: 'center',
  },
  companyFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyTextBlock: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700',
  },
  companyMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  companyDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
  },
  emptyState: {
    paddingVertical: 18,
    alignItems: 'center',
  },
});

