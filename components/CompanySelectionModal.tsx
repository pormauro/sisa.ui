import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { Company } from '@/contexts/CompaniesContext';

interface CompanySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (company: Company) => void;
}

export const CompanySelectionModal: React.FC<CompanySelectionModalProps> = ({ visible, onClose, onSelect }) => {
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const [companyQuery, setCompanyQuery] = useState('');

  const cardBackground = useThemeColor({ light: '#fff', dark: '#1a1826' }, 'background');
  const borderColor = useThemeColor({ light: '#d6d7e0', dark: '#2b2936' }, 'border');
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (!visible) {
      return;
    }
    void loadCompanies();
  }, [visible, loadCompanies]);

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

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.companyModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.companyModalContent, { backgroundColor: cardBackground, borderColor }]}>
          <View style={styles.companyModalHeader}>
            <ThemedText style={styles.companyModalTitle}>Selecciona una empresa</ThemedText>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { borderColor }]}
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
                  onPress={() => onSelect(company)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir empresa ${displayName}`}
                >
                  <View style={styles.companyItemHeader}>
                    <View style={styles.companyItemContent}>
                      <CircleImagePicker
                        fileId={company.profile_file_id ? String(company.profile_file_id) : null}
                        size={44}
                        editable={false}
                      />
                      <View style={styles.companyTextBlock}>
                        <ThemedText style={styles.companyItemTitle}>{displayName}</ThemedText>
                        {company.tax_id ? (
                          <ThemedText style={styles.companyItemSubtitle}>CUIT: {company.tax_id}</ThemedText>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={textColor} />
                  </View>
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
  );
};

const styles = StyleSheet.create({
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
  companyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  companyTextBlock: {
    flex: 1,
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
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default CompanySelectionModal;
