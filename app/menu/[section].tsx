import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { findMenuSection, MenuItem } from '@/constants/menuSections';
import { MenuButton } from '@/components/MenuButton';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompaniesContext } from '@/contexts/CompaniesContext';

const MenuGroupScreen: React.FC = () => {
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const sectionKey = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const menuSection = findMenuSection(sectionKey);

  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const router = useRouter();

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1a1826' }, 'background');
  const borderColor = useThemeColor({ light: '#d6d7e0', dark: '#2b2936' }, 'border');

  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');

  const resolveAccess = (item: MenuItem): { enabled: boolean; route: string } => {
    if (item.route === '/permission' && userId === '1') {
      return { enabled: true, route: item.route };
    }

    if (!item.requiredPermissions) {
      return { enabled: true, route: item.route };
    }

    const hasRequired = item.requiredPermissions.every(perm => permissions.includes(perm));
    if (hasRequired) {
      return { enabled: true, route: item.route };
    }

    if (item.fallbackPermissions?.some(perm => permissions.includes(perm))) {
      return {
        enabled: true,
        route: item.fallbackRoute ?? item.route,
      };
    }

    return { enabled: false, route: item.route };
  };

  const visibleItems = menuSection
    ? menuSection.items
        .map(item => ({ item, access: resolveAccess(item) }))
        .filter(entry => entry.access.enabled)
    : [];

  useEffect(() => {
    if (!isCompanyModalVisible) {
      return;
    }
    void loadCompanies();
  }, [isCompanyModalVisible, loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const query = companyQuery.trim().toLowerCase();
    if (!query) {
      return companies;
    }

    return companies.filter(company => {
      const commercial = (company.name ?? '').toLowerCase();
      const legal = (company.legal_name ?? '').toLowerCase();
      const taxId = (company.tax_id ?? '').toLowerCase();
      return (
        commercial.includes(query) ||
        legal.includes(query) ||
        taxId.includes(query) ||
        company.id.toString().includes(query)
      );
    });
  }, [companies, companyQuery]);

  const handleOpenCompanies = () => setIsCompanyModalVisible(true);

  const handleSelectCompany = (companyId: number) => {
    setIsCompanyModalVisible(false);
    router.push(`/companies/viewModal?id=${companyId}`);
  };

  const handleMenuPress = (route: string) => {
    if (route === '/companies') {
      handleOpenCompanies();
      return;
    }
    router.push(route as any);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={[styles.backButton, { borderColor: tintColor }]} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={tintColor} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              {menuSection && (
                <View style={[styles.sectionIconContainer, { backgroundColor: tintColor }]}>
                  <Ionicons name={menuSection.icon} size={28} color={iconForegroundColor} />
                </View>
              )}
              <ThemedText style={styles.headerTitle}>{menuSection?.title ?? 'Menú'}</ThemedText>
            </View>
          </View>

          {menuSection ? (
            visibleItems.length > 0 ? (
              <View style={styles.menuContainer}>
                {visibleItems.map(({ item, access }) => (
                  <MenuButton
                    key={item.route}
                    icon={item.icon}
                    title={item.title}
                    layout="grid"
                    showChevron={false}
                    onPress={() => handleMenuPress(access.route)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyStateContainer, { borderColor: tintColor }]}>
                <ThemedText style={styles.emptyStateText}>
                  No tienes permisos para acceder a estas opciones.
                </ThemedText>
              </View>
            )
          ) : (
            <View style={[styles.emptyStateContainer, { borderColor: tintColor }]}>
              <ThemedText style={styles.emptyStateText}>
                La sección seleccionada no está disponible.
              </ThemedText>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: tintColor }]}
                onPress={() => router.replace('/Home')}
              >
                <ThemedText lightColor="#FFFFFF" style={styles.primaryButtonText}>
                  Volver al menú principal
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={isCompanyModalVisible}
        onRequestClose={() => setIsCompanyModalVisible(false)}
      >
        <View style={styles.companyModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsCompanyModalVisible(false)} />
          <View style={[styles.companyModalContent, { backgroundColor: cardBackground, borderColor }]}>
            <View style={styles.companyModalHeader}>
              <ThemedText style={styles.companyModalTitle}>Selecciona una empresa</ThemedText>
              <TouchableOpacity
                onPress={() => setIsCompanyModalVisible(false)}
                style={[styles.closeButton, { borderColor: borderColor }]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selección de empresas"
              >
                <Ionicons name="close" size={22} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={[styles.companySearchContainer, { borderColor }]}> 
              <Ionicons name="search" size={18} color={textColor} />
              <TextInput
                value={companyQuery}
                onChangeText={setCompanyQuery}
                placeholder="Buscar por nombre, razón social o CUIT"
                placeholderTextColor={textColor}
                style={[styles.companySearchInput, { color: textColor }]}
              />
            </View>
            <ScrollView style={styles.companyList}>
              {filteredCompanies.map(company => {
                const displayName = (company.name ?? company.legal_name ?? '').trim() || `Empresa #${company.id}`;
                return (
                  <TouchableOpacity
                    key={company.id}
                    style={[styles.companyItem, { borderColor }]}
                    onPress={() => handleSelectCompany(company.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir empresa ${displayName}`}
                  >
                    <View style={styles.companyItemHeader}>
                      <ThemedText style={styles.companyItemTitle}>{displayName}</ThemedText>
                      <Ionicons name="chevron-forward" size={18} color={textColor} />
                    </View>
                    {company.tax_id ? (
                      <ThemedText style={styles.companyItemSubtitle}>CUIT: {company.tax_id}</ThemedText>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {filteredCompanies.length === 0 ? (
                <ThemedText style={[styles.emptyStateText, { textAlign: 'center' }]}>No hay empresas disponibles</ThemedText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MenuGroupScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 80,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    flexShrink: 1,
    lineHeight: 30,
  },
  sectionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContainer: {
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyStateContainer: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  companyModalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    padding: 16,
  },
  companyModalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: '85%',
  },
  companyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  companySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  companySearchInput: {
    flex: 1,
    fontSize: 14,
  },
  companyList: {
    maxHeight: 420,
  },
  companyItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    gap: 4,
  },
  companyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  companyItemSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
});
