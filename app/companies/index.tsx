import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

const fuseOptions: Fuse.IFuseOptions<Company> = {
  threshold: 0.35,
  keys: [
    { name: 'legal_name', weight: 0.5 },
    { name: 'name', weight: 0.4 },
    { name: 'tax_id', weight: 0.3 },
    { name: 'addresses.city', weight: 0.3 },
    { name: 'addresses.state', weight: 0.2 },
  ],
  ignoreLocation: true,
};

const getPrimaryAddress = (company: Company) => {
  if (!company.addresses?.length) {
    return '';
  }

  const primary = company.addresses[0];
  const segments = [primary.street, primary.number, primary.city, primary.state];
  return segments.filter(Boolean).join(', ');
};

const getPrimaryTaxIdentity = (company: Company) => {
  if (company.tax_id) {
    return company.tax_id;
  }

  const cuitIdentity = company.tax_identities.find(identity =>
    identity.type?.toLowerCase().includes('cuit')
  );
  if (cuitIdentity?.value) {
    return cuitIdentity.value;
  }

  return company.tax_identities[0]?.value ?? '';
};

export default function CompaniesListPage() {
  const router = useRouter();
  const { companies, loadCompanies, deleteCompany } = useContext(CompaniesContext);
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');

  const canList = permissions.includes('listCompanies');
  const canCreate = permissions.includes('addCompany');
  const canEdit = permissions.includes('updateCompany');
  const canDelete = permissions.includes('deleteCompany');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadCompanies();
    }, [canList, loadCompanies])
  );

  const fuse = useMemo(() => {
    const source = canList ? companies : [];
    return new Fuse(source, fuseOptions);
  }, [canList, companies]);

  const filteredCompanies = useMemo(() => {
    if (!canList) {
      return [];
    }
    if (!searchQuery.trim()) {
      return companies;
    }
    return fuse.search(searchQuery.trim()).map(result => result.item);
  }, [canList, companies, fuse, searchQuery]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar esta empresa?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              await deleteCompany(id);
            },
          },
        ]
      );
    },
    [deleteCompany]
  );

  const handleDeletePress = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const renderItem = ({ item }: { item: Company }) => {
    const commercialName = (item.name ?? '').trim() || (item.legal_name ?? '').trim();
    const primaryAddress = getPrimaryAddress(item).trim();
    const taxIdentity = getPrimaryTaxIdentity(item).trim();

    return (
      <TouchableOpacity
        style={[styles.itemContainer, { borderColor: itemBorderColor }]}
        onPress={() => (canList ? router.push(`/companies/viewModal?id=${item.id}`) : undefined)}
        onLongPress={() => (canEdit ? router.push(`/companies/${item.id}`) : undefined)}
        activeOpacity={0.85}
        disabled={!canList}
      >
        <View style={styles.itemContent}>
          <CircleImagePicker
            fileId={item.brand_file_id ? String(item.brand_file_id) : null}
            size={50}
            editable={false}
          />
          <View style={styles.itemInfo}>
            {commercialName ? (
              <ThemedText style={styles.itemTitle}>{commercialName}</ThemedText>
            ) : null}
            {taxIdentity ? (
              <ThemedText style={styles.itemSubtitle}>CUIT: {taxIdentity}</ThemedText>
            ) : null}
            {primaryAddress ? (
              <ThemedText style={styles.itemSubtitle}>{primaryAddress}</ThemedText>
            ) : null}
          </View>
        </View>

        {canDelete ? (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleDeletePress(event, item.id)}
            >
              <ThemedText style={styles.actionText}>🗑️</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        placeholder="Buscar empresa por razón social, CUIT o ciudad"
        value={searchQuery}
        onChangeText={setSearchQuery}
        editable={canList}
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        placeholderTextColor={placeholderColor}
      />
      {canList ? (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No se encontraron empresas</ThemedText>
          }
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canCreate ? 120 : 0 }} />}
        />
      ) : (
        <View style={styles.restrictedContainer}>
          <ThemedText style={styles.restrictedText}>
            No tienes permiso para listar empresas.
          </ThemedText>
        </View>
      )}
      {canCreate ? (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/companies/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Empresa</ThemedText>
        </TouchableOpacity>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedText: {
    textAlign: 'center',
    fontSize: 16,
  },
  itemContainer: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    marginLeft: 12,
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    fontSize: 18,
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    left: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
