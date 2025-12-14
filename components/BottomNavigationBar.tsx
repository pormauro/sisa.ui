import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/useThemeColor';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CompanySelectionModal } from '@/components/CompanySelectionModal';
import { type Company } from '@/contexts/CompaniesContext';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';
import { FileContext } from '@/contexts/FilesContext';
import { useCachedState } from '@/hooks/useCachedState';

interface NavigationItem {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  route?: string;
  badge?: number;
  isBrand?: boolean;
  translateY?: number;
  action?: () => void;
}

const getIsRouteActive = (pathname: string | null, target?: string) => {
  if (!target) return false;
  if (!pathname) return false;
  return pathname === target || pathname.startsWith(`${target}/`);
};

export const BottomNavigationBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({ light: '#cfd0d8', dark: '#cfd0d8' }, 'text');
  const barBackground = useThemeColor({ light: '#0f0d18', dark: '#0f0d18' }, 'background');

  const { notifications } = useContext(NotificationsContext);
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const { memberCompanies, loadMemberCompanies } = useContext(MemberCompaniesContext);
  const { getFile } = useContext(FileContext);
  const [selectedCompanyId, setSelectedCompanyId] = useCachedState<number | null>('selected-company-id', null);
  const [companyLogoUri, setCompanyLogoUri] = useState<string | null>(null);

  const unreadCount = useMemo(() => {
    const allowed = userId === '1' || permissions.includes('listNotifications');
    if (!allowed) return 0;
    return notifications.filter(n => !n.state.is_read && !n.state.is_hidden).length;
  }, [notifications, permissions, userId]);

  const canSelectCompany = userId === '1' || permissions.includes('listCompanies');

  const selectedCompany = useMemo<Company | null>(
    () => memberCompanies.find(company => company.id === selectedCompanyId) ?? null,
    [memberCompanies, selectedCompanyId]
  );

  useEffect(() => {
    if (!selectedCompanyId || memberCompanies.length || !canSelectCompany) {
      return;
    }
    void loadMemberCompanies();
  }, [canSelectCompany, loadMemberCompanies, memberCompanies.length, selectedCompanyId]);

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      const fileIdValue = selectedCompany?.profile_file_id;
      const numericId = fileIdValue !== null && fileIdValue !== undefined ? Number(fileIdValue) : null;

      if (!numericId || !Number.isFinite(numericId)) {
        if (isMounted) {
          setCompanyLogoUri(null);
        }
        return;
      }

      const uri = await getFile(numericId);
      if (isMounted) {
        setCompanyLogoUri(uri);
      }
    };

    void loadLogo();
    return () => {
      isMounted = false;
    };
  }, [getFile, selectedCompany?.profile_file_id]);

  const openCompanyModal = () => {
    if (!canSelectCompany) {
      router.push('/Home');
      return;
    }
    setIsCompanyModalVisible(true);
  };

  const handleSelectCompany = (company: Company | null) => {
    const nextCompanyId = company?.id ?? null;
    setSelectedCompanyId(nextCompanyId);
    setIsCompanyModalVisible(false);
    if (nextCompanyId) {
      router.push(`/companies/viewModal?id=${nextCompanyId}`);
    }
  };

  const brandLabel = useMemo(() => {
    if (!selectedCompany) {
      return 'Empresas';
    }
    const name = (selectedCompany.name ?? selectedCompany.legal_name ?? '').trim() || `Empresa #${selectedCompany.id}`;
    return name.length > 16 ? `${name.slice(0, 15)}…` : name;
  }, [selectedCompany]);

  const brandImageSource = companyLogoUri
    ? { uri: companyLogoUri }
    : require('@/assets/images/icon.png');

  const navItems: NavigationItem[] = [
    { key: 'home', label: 'Inicio', icon: 'home', route: '/Home' },
    { key: 'notifications', label: 'Avisos', icon: 'notifications-outline', badge: unreadCount, route: '/notifications' },
    { key: 'brand', label: brandLabel, isBrand: true, action: openCompanyModal },
    { key: 'profile', label: 'Perfil', icon: 'person-circle-outline', route: '/user/ProfileScreen' },
    { key: 'shortcuts', label: 'Atajos', icon: 'flash-outline', route: '/menu/shortcuts', translateY: -4 },
  ];

  const bottomPadding = Math.max(insets.bottom + 8, 12);

  return (
    <>
      <View style={[styles.container, { backgroundColor: barBackground, paddingBottom: bottomPadding }]}>

        {navItems.map(item => {
          const active = getIsRouteActive(pathname, item.route);
          const color = active ? tintColor : mutedColor;

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tab, item.translateY ? { transform: [{ translateY: item.translateY }] } : null]}
              onPress={() => {
                if (item.action) {
                  item.action();
                  return;
                }
                if (item.route) {
                  router.push(item.route);
                }
              }}
            >
              {/* Íconos normales */}
              {!item.isBrand && (
                <View style={[styles.iconCircle, { backgroundColor: barBackground }]}>
                  <Ionicons name={item.icon!} size={24} color={color} />

                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Botón central */}
              {item.isBrand && (
                <View style={[styles.brandCircle, { borderColor: tintColor, backgroundColor: barBackground }]}>
                  <Image source={brandImageSource} style={styles.brandImage} />
                </View>
              )}

              <Text style={[styles.label, { color }]}>{item.label}</Text>

            </TouchableOpacity>
          );
        })}

      </View>
      <CompanySelectionModal
        visible={isCompanyModalVisible}
        onClose={() => setIsCompanyModalVisible(false)}
        onSelect={handleSelectCompany}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 90,
    borderTopWidth: 1,
    borderColor: '#232132',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  /* CÍRCULOS GRANDES */
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ÍCONO CENTRAL MÁS GRANDE */
  brandCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandImage: {
    width: '100%',
    height: '100%',
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'center',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ff4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default BottomNavigationBar;
