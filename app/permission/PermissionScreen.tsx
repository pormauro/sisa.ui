import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Button,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import UserSelector from './UserSelector'; // Asegúrate de que la ruta sea correcta
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import NetInfo from '@react-native-community/netinfo';
import {
  enqueueOperation,
  createSyncQueueTable,
  deleteQueueItem,
  getAllQueueItems,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalPermissionsTable,
  getPermissionsByUserLocal,
  insertPermissionLocal,
  deletePermissionLocal,
  clearPermissionsByUserLocal,
} from '@/src/database/permissionsLocalDB';

// Definición de grupos de permisos. Cada grupo contiene una lista de "sectors" (cadenas que representan los permisos)
const PERMISSION_GROUPS = [
  { group: "Permissions", permissions: ['listGlobalPermissions','listPermissionsByUser','listPermissions', 'addPermission', 'deletePermission','listAllProfiles'] },
  { group: "Files", permissions: ['uploadFile', 'downloadFile'] },
  { group: "Clients", permissions: ['getClient', 'addClient', 'updateClient', 'deleteClient', 'listClients'] },
  { group: "Folders", permissions: ['listFolders', 'getFolder', 'addFolder', 'updateFolder', 'deleteFolder', 'listFolderHistory', 'listFoldersByClient'] },
  { group: "Cash Boxes", permissions: ['listCashBoxes', 'getCashBox', 'addCashBox', 'updateCashBox', 'deleteCashBox', 'listCashBoxHistory'] },
  { group: "Payments", permissions: ['listPayments', 'getPayment', 'addPayment', 'updatePayment', 'deletePayment', 'listPaymentHistory'] },
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
  { group: "Statuses", permissions: ['listStatuses', 'getStatus', 'addStatus', 'updateStatus', 'deleteStatus', 'reorderStatuses'] },
];

interface AssignedPermission {
  id: number;
  sector: string;
  syncStatus?: 'pending' | 'error';
}

const PermissionScreen: React.FC = () => {
  const { token } = useContext(AuthContext);
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string } | null>(null);
  const [assignedPermissions, setAssignedPermissions] = useState<Record<string, AssignedPermission>>({});
  const [loading, setLoading] = useState(false);

  const background = useThemeColor({}, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const groupBorderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');

  // Función para cargar permisos del usuario seleccionado (o global si id === 0)
  const loadPermissions = useCallback(async () => {
    if (!token || selectedUser === null) return;
    setLoading(true);
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localPerms = await getPermissionsByUserLocal(selectedUser.id);
      const permissionsMap: Record<string, AssignedPermission> = {};
      localPerms.forEach((perm: any) => {
        permissionsMap[perm.sector] = { id: perm.id, sector: perm.sector };
      });
      setAssignedPermissions(permissionsMap);
      console.log('Sin conexión: Mostrando permisos locales.');
      setLoading(false);
      return;
    }

    const url = selectedUser.id === 0
      ? `${BASE_URL}/permissions/global`
      : `${BASE_URL}/permissions/user/${selectedUser.id}`;

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      const permissionsMap: Record<string, AssignedPermission> = {};
      data.permissions.forEach((perm: AssignedPermission) => {
        permissionsMap[perm.sector] = perm;
      });
      setAssignedPermissions(permissionsMap);
      await clearPermissionsByUserLocal(selectedUser.id);
      for (const perm of data.permissions) {
        await insertPermissionLocal({ id: perm.id, user_id: selectedUser.id, sector: perm.sector });
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
      console.error('Error: No se pudieron cargar los permisos.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedUser]);

  const processQueue = async () => {
    if (!token) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      if (item.table_name !== 'permissions') continue;
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (item.op === 'create') {
          const res = await fetch(`${BASE_URL}/permissions`, {
            method: 'POST',
            headers,
            body: item.payload_json,
          });
          if (res.ok) {
            const data = await res.json();
            const perm = data.permission || data;
            setAssignedPermissions(prev => ({
              ...prev,
              [perm.sector]: { id: perm.id, sector: perm.sector },
            }));
            await deletePermissionLocal(item.local_temp_id);
            const payload = JSON.parse(item.payload_json);
            await insertPermissionLocal({ id: perm.id, user_id: payload.user_id || 0, sector: perm.sector });
            await deleteQueueItem(item.id);
          } else {
            await updateQueueItemStatus(item.id, 'error', `HTTP ${res.status}`);
            break;
          }
        } else if (item.op === 'delete') {
          const res = await fetch(`${BASE_URL}/permissions/${item.record_id}`, {
            method: 'DELETE',
            headers,
          });
          if (res.ok) {
            await deleteQueueItem(item.id);
          } else {
            await updateQueueItemStatus(item.id, 'error', `HTTP ${res.status}`);
            break;
          }
        }
      } catch (err) {
        await updateQueueItemStatus(item.id, 'error', String(err));
        break;
      }
    }
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalPermissionsTable();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions();
    } else {
      setAssignedPermissions({});
    }
  }, [selectedUser, loadPermissions]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue().catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [token]);

  // Función para agregar un permiso; se retorna la promesa
  const addPermission = async (sector: string) => {
    if (!token || selectedUser === null) return;
    const bodyData: any = { sector };
    if (selectedUser.id !== 0) {
      bodyData.user_id = selectedUser.id;
    }

    const state = await NetInfo.fetch();
    const current = assignedPermissions[sector];
    const tempId = current?.id ?? -Date.now();
    if (!state.isConnected) {
      if (!current) {
        setAssignedPermissions(prev => ({
          ...prev,
          [sector]: { id: tempId, sector, syncStatus: 'pending' },
        }));
      }
      await insertPermissionLocal({ id: tempId, user_id: selectedUser.id, sector });
      await enqueueOperation('permissions', 'create', bodyData, null, tempId);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (data.id || data.permission) {
        const id = data.id ?? data.permission.id;
        setAssignedPermissions(prev => ({ ...prev, [sector]: { id, sector } }));
        await deletePermissionLocal(tempId);
        await insertPermissionLocal({ id, user_id: selectedUser.id, sector });
      }
    } catch (err) {
      console.error(`Error adding permission ${sector}:`, err);
      console.error(`Error: No se pudo agregar el permiso ${sector}`);
    }
    await processQueue();
  };
  
  // Función para eliminar un permiso; se retorna la promesa
  const removePermission = async (sector: string) => {
    if (!token || selectedUser === null) return;
    const perm = assignedPermissions[sector];
    if (!perm) return;
    const state = await NetInfo.fetch();

    if (perm.id < 0) {
      const items = await getAllQueueItems();
      const createItem = items.find(
        (i: any) => i.table_name === 'permissions' && i.op === 'create' && i.local_temp_id === perm.id
      );
      if (createItem) {
        await deleteQueueItem(createItem.id);
      }
      await deletePermissionLocal(perm.id);
      return;
    }

    if (!state.isConnected) {
      await deletePermissionLocal(perm.id);
      await enqueueOperation('permissions', 'delete', {}, perm.id, null);
      return;
    }

    try {
      await fetch(`${BASE_URL}/permissions/${perm.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      await deletePermissionLocal(perm.id);
    } catch (err) {
      console.error(`Error deleting permission ${sector}:`, err);
      console.error(`Error: No se pudo eliminar el permiso ${sector}`);
    }
    await processQueue();
  };

  // Actualiza el estado de forma optimista y luego llama a la API
  const togglePermission = (sector: string, value: boolean) => {
    // Actualización optimista: actualizamos el estado de inmediato
    setAssignedPermissions(prev => {
      const newState = { ...prev };
      if (value) {
        newState[sector] = { id: -Date.now(), sector, syncStatus: 'pending' };
      } else {
        delete newState[sector];
      }
      return newState;
    });

    if (value) {
      addPermission(sector);
    } else {
      removePermission(sector);
    }
  };

  const toggleGroup = (groupPermissions: string[], value: boolean) => {
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
    PERMISSION_GROUPS.forEach(group => {
      group.permissions.forEach(sector => {
        if (!assignedPermissions[sector]) {
          togglePermission(sector, true);
        }
      });
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.title}>Administración de Permisos</ThemedText>
      <UserSelector onSelect={(user) => {
        if (user) {
          setSelectedUser({ id: user.id, username: user.username });
        } else {
          setSelectedUser({ id: 0, username: 'Global' }); // <-- Nunca más null
        }
      }} />

      
      {selectedUser ? (
        loading ? (
          <ActivityIndicator size="large" color={spinnerColor} />
        ) : (
          <>
            <View style={{ marginBottom: 10 }}>
              <Button title="Activar todo" onPress={toggleAll} />
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
                  />
                  <ThemedText style={styles.groupTitle}>{group.group}</ThemedText>
                </View>
                {group.permissions.map(sector => (
                  <View key={sector} style={styles.permissionRow}>
                    <Checkbox
                      value={!!assignedPermissions[sector]}
                      onValueChange={(value) => togglePermission(sector, value)}
                      style={styles.checkbox}
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
});
