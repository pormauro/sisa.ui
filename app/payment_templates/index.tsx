import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import { Ionicons } from '@expo/vector-icons';

import {
  PaymentTemplatesContext,
  PaymentTemplate,
} from '@/contexts/PaymentTemplatesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { MenuButton } from '@/components/MenuButton';
import { useCachedState } from '@/hooks/useCachedState';
import { toMySQLDateTime } from '@/utils/date';

type TemplateSortOption = 'updated' | 'name' | 'amount';

type TemplateListItem = PaymentTemplate & {
  displayAmount: string;
  displayUpdatedAt: string;
};

const SORT_OPTIONS: { label: string; value: TemplateSortOption }[] = [
  { label: 'Actualización reciente', value: 'updated' },
  { label: 'Nombre', value: 'name' },
  { label: 'Monto predeterminado', value: 'amount' },
];

const fuseOptions: Fuse.IFuseOptions<TemplateListItem> = {
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'description', weight: 0.3 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
};

const getUpdatedLabel = (template: PaymentTemplate): string => {
  const value = template.updated_at || template.created_at;
  if (!value) {
    return toMySQLDateTime(new Date());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return toMySQLDateTime(parsed);
};

export default function PaymentTemplatesScreen() {
  const router = useRouter();
  const { paymentTemplates, loadPaymentTemplates, deletePaymentTemplate } = useContext(
    PaymentTemplatesContext
  );
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useCachedState<string>(
    'paymentTemplates.filters.searchQuery',
    ''
  );
  const [selectedSort, setSelectedSort] = useCachedState<TemplateSortOption>(
    'paymentTemplates.filters.selectedSort',
    'updated'
  );
  const [sortDescending, setSortDescending] = useCachedState<'asc' | 'desc'>(
    'paymentTemplates.filters.direction',
    'desc'
  );

  const listItems = useMemo<TemplateListItem[]>(() => {
    return paymentTemplates.map(template => ({
      ...template,
      displayAmount:
        typeof template.default_amount === 'number'
          ? `$${template.default_amount.toFixed(2)}`
          : 'Sin monto',
      displayUpdatedAt: getUpdatedLabel(template),
    }));
  }, [paymentTemplates]);

  const fuse = useMemo(() => {
    if (listItems.length === 0) {
      return null;
    }
    return new Fuse(listItems, fuseOptions);
  }, [listItems]);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!permissions.includes('listPaymentTemplates')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver las plantillas de pago.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listPaymentTemplates')) {
        return;
      }
      void loadPaymentTemplates();
    }, [permissions, loadPaymentTemplates])
  );

  const filteredTemplates = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    const base = trimmedQuery
      ? fuse?.search(trimmedQuery)?.map(result => result.item) ?? listItems
      : listItems;

    const sorted = [...base];
    sorted.sort((a, b) => {
      const directionMultiplier = sortDescending === 'asc' ? 1 : -1;
      switch (selectedSort) {
        case 'name':
          return (
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) *
            directionMultiplier
          );
        case 'amount':
          return (
            ((a.default_amount ?? 0) - (b.default_amount ?? 0)) * directionMultiplier
          );
        case 'updated':
        default: {
          const aTime = new Date(a.displayUpdatedAt).getTime();
          const bTime = new Date(b.displayUpdatedAt).getTime();
          return (aTime - bTime) * directionMultiplier;
        }
      }
    });
    return sorted;
  }, [fuse, listItems, searchQuery, selectedSort, sortDescending]);

  const canCreate = permissions.includes('addPaymentTemplate');
  const canDelete = permissions.includes('deletePaymentTemplate');
  const canEdit = permissions.includes('updatePaymentTemplate');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Eliminar plantilla', '¿Deseas eliminar esta plantilla de pago?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void deletePaymentTemplate(id);
          },
        },
      ]);
    },
    [deletePaymentTemplate]
  );

  const renderItem = useCallback(
    ({ item }: { item: TemplateListItem }) => (
      <View style={styles.cardWrapper}>
        <MenuButton
          title={item.name}
          subtitle={`${item.displayAmount} · Actualizada ${item.displayUpdatedAt}`}
          icon="flame-outline"
          onPress={() => router.push(`/payment_templates/viewModal?id=${item.id}`)}
          onLongPress={canEdit ? () => router.push(`/payment_templates/${item.id}`) : undefined}
        />
        {canDelete ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.deleteButton, { backgroundColor: inputBackground, borderColor }]}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash" size={18} color={tintColor} />
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [borderColor, canDelete, canEdit, handleDelete, inputBackground, router, tintColor]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.search,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          placeholder="Buscar plantilla..."
          placeholderTextColor={placeholderColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(option => {
          const isSelected = option.value === selectedSort;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                {
                  backgroundColor: isSelected ? tintColor : inputBackground,
                  borderColor,
                },
              ]}
              onPress={() => {
                if (selectedSort === option.value) {
                  setSortDescending(prev => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSelectedSort(option.value);
                }
              }}
            >
              <ThemedText
                style={[
                  styles.sortText,
                  { color: isSelected ? addButtonTextColor : inputTextColor },
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      <FlatList
        data={filteredTemplates}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron plantillas.</ThemedText>
        }
        contentContainerStyle={styles.listContent}
      />
      {canCreate ? (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/payment_templates/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Nueva plantilla</ThemedText>
        </TouchableOpacity>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchRow: {
    marginBottom: 12,
  },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  sortRow: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardWrapper: {
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 20,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});

