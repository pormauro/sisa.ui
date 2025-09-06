import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, Button } from 'react-native';
import Checkbox from 'expo-checkbox';
import UserSelector from './UserSelector'; // Asegúrate de que la ruta sea correcta
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

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
}

const PermissionScreen: React.FC = () => {
  const { token } = useContext(AuthContext);
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string } | null>(null);
  const [assignedPermissions, setAssignedPermissions] = useState<Record<string, AssignedPermission>>({});
  const [loading, setLoading] = useState(false);

  // Función para cargar permisos del usuario seleccionado (o global si id === 0)
  const loadPermissions = useCallback(() => {
    if (!token || selectedUser === null) return;
    setLoading(true);
    const url = selectedUser.id === 0 
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
  }, [token, selectedUser]);

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
      })
      .catch(err => {
        console.error(`Error adding permission ${sector}:`, err);
        Alert.alert('Error', `No se pudo agregar el permiso ${sector}`);
      });
  };
  
  // Función para eliminar un permiso; se retorna la promesa
  const removePermission = (sector: string) => {
    if (!token || selectedUser === null) return Promise.resolve();
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
      })
      .catch(err => {
        console.error(`Error deleting permission ${sector}:`, err);
        Alert.alert('Error', `No se pudo eliminar el permiso ${sector}`);
      });
  };

  // Actualiza el estado de forma optimista y luego llama a la API
  const togglePermission = (sector: string, value: boolean) => {
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
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Administración de Permisos</Text>
      <UserSelector onSelect={(user) => {
        if (user) {
          setSelectedUser({ id: user.id, username: user.username });
        } else {
          setSelectedUser({ id: 0, username: 'Global' }); // <-- Nunca más null
        }
      }} />

      
      {selectedUser ? (
        loading ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : (
          <>
            <View style={{ marginBottom: 10 }}>
              <Button title="Activar todo" onPress={toggleAll} />
            </View>
            {PERMISSION_GROUPS.map(group => (
              <View key={group.group} style={styles.groupContainer}>
                <View style={styles.groupHeader}>
                  <Checkbox
                    value={isGroupChecked(group.permissions)}
                    onValueChange={(value) => toggleGroup(group.permissions, value)}
                    style={styles.checkbox}
                  />
                  <Text style={styles.groupTitle}>{group.group}</Text>
                </View>
                {group.permissions.map(sector => (
                  <View key={sector} style={styles.permissionRow}>
                    <Checkbox
                      value={!!assignedPermissions[sector]}
                      onValueChange={(value) => togglePermission(sector, value)}
                      style={styles.checkbox}
                    />
                    <Text style={styles.permissionLabel}>{sector}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )
      ) : (
        <Text style={styles.infoText}>Selecciona un usuario o Global para administrar permisos.</Text>
      )}
    </ScrollView>
  );
};

export default PermissionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
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
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f9f9f9'
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
