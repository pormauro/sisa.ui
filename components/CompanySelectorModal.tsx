import React, { useEffect, useMemo } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Company, useCompanyContext } from '@/contexts/CompanyContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';

interface CompanySelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIALS_COLORS = ['#6C63FF', '#00B0FF', '#FF7043', '#26A69A', '#AB47BC'];

const CompanyLogo = ({ company }: { company: Company }) => {
  const uri = useCompanyLogo(company.profile_file_id);
  const textColor = useThemeColor({ light: '#111827', dark: '#f9fafb' }, 'text');

  const initials = useMemo(() => {
    if (!company.name) return '?';
    const words = company.name.trim().split(/\s+/).slice(0, 2);
    return words.map(word => word.charAt(0).toUpperCase()).join('') || '?';
  }, [company.name]);

  const fallbackColor = useMemo(() => {
    const index = company.id % INITIALS_COLORS.length;
    return INITIALS_COLORS[Math.abs(index)];
  }, [company.id]);

  if (uri) {
    return <Image source={{ uri }} style={styles.logoImage} />;
  }

  return (
    <View style={[styles.logoFallback, { backgroundColor: fallbackColor }]}>
      <ThemedText style={[styles.logoText, { color: textColor }]}>{initials}</ThemedText>
    </View>
  );
};

export const CompanySelectorModal: React.FC<CompanySelectorModalProps> = ({ visible, onClose }) => {
  const { companies, activeCompany, loadFromStorage, setActiveCompany } = useCompanyContext();
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1c1c1f' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#2f2f36' }, 'border');
  const textColor = useThemeColor({}, 'text');
  const subtleText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const modalOverlay = useThemeColor({ light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.6)' }, 'background');
  const accent = useThemeColor({}, 'tint');

  useEffect(() => {
    if (visible) {
      void loadFromStorage();
    }
  }, [loadFromStorage, visible]);

  const handleSelect = (company: Company) => {
    void setActiveCompany(company);
    onClose();
  };

  const renderItem = ({ item }: { item: Company }) => {
    const isActive = activeCompany?.id === item.id;
    const displayName = item.name || item.legal_name || 'Empresa sin nombre';
    return (
      <TouchableOpacity
        style={[
          styles.companyCard,
          {
            backgroundColor: cardBackground,
            borderColor: isActive ? accent : borderColor,
            borderWidth: isActive ? 2 : 1,
          },
        ]}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar empresa ${displayName}`}
      >
        <CompanyLogo company={item} />
        <View style={styles.companyInfo}>
          <ThemedText style={[styles.companyName, { color: textColor }]} numberOfLines={1}>
            {displayName}
          </ThemedText>
          {item.legal_name && item.legal_name !== displayName ? (
            <ThemedText style={[styles.companyLegal, { color: subtleText }]} numberOfLines={1}>
              {item.legal_name}
            </ThemedText>
          ) : null}
        </View>
        {isActive ? <View style={[styles.activeDot, { backgroundColor: accent }]} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: modalOverlay }]} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: cardBackground }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: textColor }]}>Seleccionar empresa</ThemedText>
            <ThemedText style={{ color: subtleText }}>
              Elige la empresa activa para navegar en la aplicación.
            </ThemedText>
          </View>

          <FlatList
            data={companies}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText style={{ color: subtleText }}>No hay empresas disponibles.</ThemedText>
              </View>
            }
          />

          <TouchableOpacity style={[styles.closeButton, { borderColor }]} onPress={onClose}>
            <ThemedText style={{ color: textColor }}>Cerrar</ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    maxHeight: 400,
  },
  separator: {
    height: 10,
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  companyInfo: {
    flex: 1,
    gap: 2,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
  },
  companyLegal: {
    fontSize: 13,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: '700',
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyState: {
    padding: 12,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
});
