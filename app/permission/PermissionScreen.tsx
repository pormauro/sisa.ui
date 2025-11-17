import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Button,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import UserSelector, { type Profile as SelectorProfile } from './UserSelector'; // Asegúrate de que la ruta sea correcta
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { BASE_URL } from '@/config/Index';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

// Definición de grupos de permisos. Cada grupo contiene una lista de "sectors" (cadenas que representan los permisos)
const PERMISSION_GROUPS = [
  { group: "Permissions", permissions: ['listGlobalPermissions','listPermissionsByUser','listPermissions', 'addPermission', 'deletePermission','listAllProfiles'] },
  { group: "Companies", permissions: ['listCompanies', 'addCompany', 'updateCompany', 'deleteCompany'] },
  { group: "Files", permissions: ['uploadFile', 'downloadFile'] },
  { group: "Clients", permissions: ['getClient', 'addClient', 'updateClient', 'deleteClient', 'listClients'] },
  { group: "Folders", permissions: ['listFolders', 'getFolder', 'addFolder', 'updateFolder', 'deleteFolder', 'listFolderHistory', 'listFoldersByClient'] },
  { group: "Cash Boxes", permissions: ['listCashBoxes', 'getCashBox', 'addCashBox', 'updateCashBox', 'deleteCashBox', 'listCashBoxHistory'] },
  { group: "Payments", permissions: ['listPayments', 'getPayment', 'addPayment', 'updatePayment', 'deletePayment', 'listPaymentHistory'] },
  {
    group: "Invoices",
    permissions: [
      'listInvoices',
      'getInvoice',
      'addInvoice',
      'updateInvoice',
      'deleteInvoice',
      'voidInvoice',
      'issueInvoice',
      'downloadInvoicePdf',
      'listInvoiceHistory',
    ],
  },
  {
    group: "Payment Templates",
    permissions: [
      'listPaymentTemplates',
      'getPaymentTemplate',
      'addPaymentTemplate',
      'updatePaymentTemplate',
      'deletePaymentTemplate',
      'usePaymentTemplateShortcuts',
    ],
  },
  { group: "Receipts", permissions: ['listReceipts', 'getReceipt', 'addReceipt', 'updateReceipt', 'deleteReceipt', 'listReceiptHistory'] },
  { group: "Categories", permissions: ['listCategories', 'getCategory', 'addCategory', 'updateCategory', 'deleteCategory', 'listCategoryHistory'] },
  { group: "Providers", permissions: ['listProviders', 'getProvider', 'addProvider', 'updateProvider', 'deleteProvider', 'listProviderHistory'] },
  { group: "Sales", permissions: ['listSales', 'getSale', 'addSale', 'updateSale', 'deleteSale', 'listSaleHistory'] },
  { group: "Products / Services", permissions: ['listProductsServices', 'getProductService', 'addProductService', 'updateProductService', 'deleteProductService', 'listProductServiceHistory'] },
  { group: "Jobs", permissions: ['listJobs', 'getJob', 'addJob', 'updateJob', 'deleteJob', 'listJobHistory'] },
  { group: "Tariffs", permissions: ['listTariffs', 'getTariff', 'addTariff', 'updateTariff', 'deleteTariff', 'listTariffHistory'] },
  { group: "Expenses", permissions: ['listExpenses', 'getExpense', 'addExpense', 'updateExpense', 'deleteExpense', 'listExpenseHistory'] },
  { group: "Appointments", permissions: ['listAppointments', 'getAppointment', 'addAppointment', 'updateAppointment', 'deleteAppointment', 'listAppointmentHistory'] },
  { group: "Accounting Closings", permissions: ['listClosings', 'getClosing', 'addClosing', 'updateClosing', 'deleteClosing', 'listClosingHistory'] },
  { group: "User Profile", permissions: ['listUserProfiles', 'getUserProfile', 'addUserProfile'] },
  { group: "User Configurations", permissions: ['listUserConfigurations', 'getUserConfigurations', 'addUserConfigurations'] },
  { group: "Comments", permissions: ['listComments', 'addComment', 'respondComment'] },
  { group: "Statuses", permissions: ['listStatuses', 'getStatus', 'addStatus', 'updateStatus', 'deleteStatus', 'reorderStatuses'] },
];

interface AssignedPermission {
  id: number;
  sector: string;
}

const PermissionScreen: React.FC = () => {
  const { token, userId, username } = useContext(AuthContext);
  const { permissions: currentPermissions, refreshPermissions } = useContext(PermissionsContext);
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string } | null>(null);
  const [assignedPermissions, setAssignedPermissions] = useState<Record<string, AssignedPermission>>({});
  const [loading, setLoading] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const background = useThemeColor({}, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const groupBorderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');

  const numericUserId = useMemo(() => (userId ? Number(userId) : null), [userId]);
  const fallbackUsername = username ?? 'Mi usuario';
  const isMasterUser = numericUserId === 1;

  const shouldRefreshContext = useCallback(() => {
    if (!selectedUser) {
      return false;
    }
    if (selectedUser.id === 0) {
      return true;
    }
    if (numericUserId === null) {
      return false;
    }
    return selectedUser.id === numericUserId;
  }, [numericUserId, selectedUser]);

  const triggerPermissionsRefresh = useCallback(() => {
    if (!shouldRefreshContext()) {
      return;
    }
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void refreshPermissions();
    }, 300);
  }, [refreshPermissions, shouldRefreshContext]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  const canListPermissions = useMemo(
    () =>
      isMasterUser ||
      currentPermissions.includes('listPermissions') ||
      currentPermissions.includes('listPermissionsByUser') ||
      currentPermissions.includes('listGlobalPermissions'),
    [currentPermissions, isMasterUser],
  );

  const canManagePermissions = useMemo(
    () =>
      isMasterUser ||
      currentPermissions.includes('addPermission') ||
      currentPermissions.includes('deletePermission'),
    [currentPermissions, isMasterUser],
  );

  const canViewGlobalPermissions = useMemo(
    () => isMasterUser || currentPermissions.includes('listGlobalPermissions'),
    [currentPermissions, isMasterUser],
  );

  const canViewOtherUsersPermissions = useMemo(
    () => isMasterUser || currentPermissions.includes('listPermissionsByUser'),
    [currentPermissions, isMasterUser],
  );

  const canBrowseProfiles = useMemo(
    () => isMasterUser || currentPermissions.includes('listAllProfiles'),
    [currentPermissions, isMasterUser],
  );

  const canSelectOtherUsers = canBrowseProfiles && canViewOtherUsersPermissions;
  const canSelectGlobal = canViewGlobalPermissions;
  const canChooseUser = canSelectOtherUsers || canSelectGlobal;

  const canEditSelection = useMemo(() => {
    if (!selectedUser) return false;
    if (!canManagePermissions) return false;
    if (selectedUser.id === 0) {
      return canViewGlobalPermissions;
    }
    if (numericUserId !== null && selectedUser.id === numericUserId) {
      return true;
    }
    return canSelectOtherUsers;
  }, [selectedUser, canManagePermissions, canSelectOtherUsers, canViewGlobalPermissions, numericUserId]);

  useEffect(() => {
    if (!numericUserId) {
      return;
    }

    if (!canChooseUser) {
      if (!selectedUser || selectedUser.id !== numericUserId) {
        setSelectedUser({ id: numericUserId, username: fallbackUsername });
      }
    }
  }, [numericUserId, canChooseUser, selectedUser, fallbackUsername]);

  // Función para cargar permisos del usuario seleccionado (o global si id === 0)
  const loadPermissions = useCallback(() => {
    if (!token || selectedUser === null || !canListPermissions) {
      setAssignedPermissions({});
      return Promise.resolve();
    }

    const isGlobalSelection = selectedUser.id === 0;
    const isOwnSelection = numericUserId !== null && selectedUser.id === numericUserId;

    if (isGlobalSelection && !canViewGlobalPermissions) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver los permisos globales.');
      setAssignedPermissions({});
      return Promise.resolve();
    }

    if (!isGlobalSelection && !isOwnSelection && !canSelectOtherUsers) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver los permisos de otros usuarios.');
      setAssignedPermissions({});
      return Promise.resolve();
    }

    setLoading(true);
    const url = isGlobalSelection
      ? `${BASE_URL}/permissions/global`
      : `${BASE_URL}/permissions/user/${selectedUser.id}`;

    return fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        const permissionsMap: Record<string, AssignedPermission> = {};
        data.permissions.forEach((perm: AssignedPermission) => {
          permissionsMap[perm.sector] = perm;
        });
        setAssignedPermissions(permissionsMap);
      })
      .catch(err => {
        console.error('Error loading permissions:', err);
        Alert.alert('Error', 'No se pudieron cargar los permisos.');
      })
      .finally(() => setLoading(false));
  }, [token, selectedUser, canListPermissions, canViewGlobalPermissions, canSelectOtherUsers, numericUserId]);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions();
    } else {
      setAssignedPermissions({});
    }
  }, [selectedUser, loadPermissions]);

  // Función para agregar un permiso; se retorna la promesa
  const addPermission = (sector: string) => {
    if (!token || selectedUser === null) return Promise.resolve();

    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return Promise.resolve();
    }
    const bodyData: any = { sector };

    if (selectedUser.id !== 0) {
      bodyData.user_id = selectedUser.id;
    }
  
    return fetch(`${BASE_URL}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData),
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setAssignedPermissions(prev => ({
            ...prev,
            [sector]: { id: data.id, sector }
          }));
        }
        triggerPermissionsRefresh();
      })
      .catch(err => {
        console.error(`Error adding permission ${sector}:`, err);
        Alert.alert('Error', `No se pudo agregar el permiso ${sector}`);
      });
  };
  
  // Función para eliminar un permiso; se retorna la promesa
  const removePermission = (sector: string) => {
    if (!token || selectedUser === null) return Promise.resolve();

    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return Promise.resolve();
    }
    const perm = assignedPermissions[sector];
    if (!perm) return Promise.resolve();
    return fetch(`${BASE_URL}/permissions/${perm.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then(() => {
        setAssignedPermissions(prev => {
          const newPerms = { ...prev };
          delete newPerms[sector];
          return newPerms;
        });
        triggerPermissionsRefresh();
      })
      .catch(err => {
        console.error(`Error deleting permission ${sector}:`, err);
        Alert.alert('Error', `No se pudo eliminar el permiso ${sector}`);
      });
  };

  // Actualiza el estado de forma optimista y luego llama a la API
  const togglePermission = (sector: string, value: boolean) => {
    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return;
    }
    // Actualización optimista: actualizamos el estado de inmediato
    setAssignedPermissions(prev => {
      const newState = { ...prev };
      if (value) {
        newState[sector] = { id: -Date.now(), sector }; // id temporal
      } else {
        delete newState[sector];
      }
      return newState;
    });

    // Luego se realiza la llamada a la API
    if (value) {
      addPermission(sector);
    } else {
      removePermission(sector);
    }
  };

  const toggleGroup = (groupPermissions: string[], value: boolean) => {
    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return;
    }
    groupPermissions.forEach(sector => {
      const isAssigned = !!assignedPermissions[sector];
      if (value && !isAssigned) {
        togglePermission(sector, true);
      } else if (!value && isAssigned) {
        togglePermission(sector, false);
      }
    });
  };

  const isGroupChecked = (groupPermissions: string[]) => {
    return groupPermissions.every(sector => !!assignedPermissions[sector]);
  };

  const toggleAll = () => {
    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return;
    }
    PERMISSION_GROUPS.forEach(group => {
      group.permissions.forEach(sector => {
        if (!assignedPermissions[sector]) {
          togglePermission(sector, true);
        }
      });
    });
  };

  const removeAll = () => {
    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return;
    }

    Object.keys(assignedPermissions).forEach(sector => {
      if (assignedPermissions[sector]) {
        togglePermission(sector, false);
      }
    });
  };

  const handleUserSelection = useCallback(
    (user: SelectorProfile | null) => {
      if (user === null) {
        if (!canSelectGlobal) {
          Alert.alert('Acceso denegado', 'No tienes permiso para administrar los permisos globales.');
          return;
        }
        setSelectedUser({ id: 0, username: 'Global' });
        return;
      }

      if (numericUserId !== null && user.id !== numericUserId && !canSelectOtherUsers) {
        Alert.alert('Acceso denegado', 'No puedes administrar permisos de otros usuarios.');
        return;
      }

      setSelectedUser({ id: user.id, username: user.username });
    },
    [canSelectGlobal, canSelectOtherUsers, numericUserId],
  );

  const restrictedProfileFilter = useMemo(() => {
    if (canSelectOtherUsers || numericUserId === null) {
      return undefined;
    }
    return (profile: SelectorProfile) => profile.id === numericUserId;
  }, [canSelectOtherUsers, numericUserId]);

  if (!canListPermissions) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ThemedText style={styles.title}>Administración de Permisos</ThemedText>
        <ThemedText style={styles.infoText}>
          No tienes acceso para visualizar la administración de permisos.
        </ThemedText>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ThemedText style={styles.title}>Administración de Permisos</ThemedText>
      {canChooseUser ? (
        <UserSelector
          includeGlobal={canSelectGlobal}
          filterProfiles={restrictedProfileFilter}
          onSelect={handleUserSelection}
        />
      ) : (
        <ThemedText style={styles.infoText}>
          Gestionando permisos para: {fallbackUsername}
        </ThemedText>
      )}


      {selectedUser ? (
        loading ? (
          <ActivityIndicator size="large" color={spinnerColor} />
        ) : (
          <>
            <View style={styles.actionsRow}>
              <View style={[styles.actionButton, styles.actionButtonSpacing]}>
                <Button title="Activar todo" onPress={toggleAll} disabled={!canEditSelection} />
              </View>
              <View style={styles.actionButton}>
                <Button title="Quitar todo" onPress={removeAll} disabled={!canEditSelection} />
              </View>
            </View>
            {PERMISSION_GROUPS.map(group => (
              <ThemedView
                key={group.group}
                style={[styles.groupContainer, { borderColor: groupBorderColor }]}
                lightColor="#f9f9f9"
                darkColor="#1e1e1e"
              >
                <View style={styles.groupHeader}>
                  <Checkbox
                    value={isGroupChecked(group.permissions)}
                    onValueChange={(value) => toggleGroup(group.permissions, value)}
                    style={styles.checkbox}
                    disabled={!canEditSelection}
                  />
                  <ThemedText style={styles.groupTitle}>{group.group}</ThemedText>
                </View>
                {group.permissions.map(sector => (
                  <View key={sector} style={styles.permissionRow}>
                    <Checkbox
                      value={!!assignedPermissions[sector]}
                      onValueChange={(value) => togglePermission(sector, value)}
                      style={styles.checkbox}
                      disabled={!canEditSelection}
                    />
                    <ThemedText style={styles.permissionLabel}>{sector}</ThemedText>
                  </View>
                ))}
              </ThemedView>
            ))}
          </>
        )
      ) : (
        <ThemedText style={styles.infoText}>
          Selecciona un usuario o Global para administrar permisos.
        </ThemedText>
      )}
    </ScrollView>
  );
};

export default PermissionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20
  },
  groupContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    marginLeft: 20
  },
  permissionLabel: {
    fontSize: 16,
    marginLeft: 8
  },
  checkbox: {
    marginRight: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonSpacing: {
    marginRight: 12,
  },
});
