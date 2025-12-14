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
import { useCachedState } from '@/hooks/useCachedState';

// Definición de grupos de permisos. Cada grupo contiene una lista de "sectors" (cadenas que representan los permisos)
const PERMISSION_GROUPS = [
  {
    group: "Permissions",
    permissions: [
      'listGlobalPermissions',
      'listPermissionsByUser',
      'listPermissions',
      'addPermission',
      'deletePermission',
      'listAllProfiles',
    ],
  },
  {
    group: "Companies",
    permissions: [
      'searchCompanies',
      'listCompanies',
      'getCompany',
      'createCompany',
      'updateCompany',
      'deleteCompany',
      'historyCompany',
    ],
  },
  {
    group: "Company Memberships",
    permissions: [
      'listCompanyMembers',
      'listUserCompanyMemberships',
      'manageCompanyMemberships',
      'inviteCompanyMembers',
      'cancelCompanyInvitations',
      'reactivateCompanyMember',
      'acceptCompanyInvitation',
      'requestCompanyMembership',
      'leaveCompanyMembership',
      'suspendCompanyMember',
      'removeCompanyMember',
    ],
  },
  { group: "Files", permissions: ['uploadFile', 'downloadFile'] },
  { group: "Clients", permissions: ['getClient', 'addClient', 'updateClient', 'deleteClient', 'listClients'] },
  { group: "Folders", permissions: ['listFolders', 'getFolder', 'addFolder', 'updateFolder', 'deleteFolder', 'listFolderHistory', 'listFoldersByClient'] },
  {
    group: "Cash Boxes",
    permissions: [
      'listCashBoxes',
      'getCashBox',
      'addCashBox',
      'updateCashBox',
      'deleteCashBox',
      'listCashBoxHistory',
      'assignCashBoxUsers',
      'manageCashBoxPermissions',
    ],
  },
  { group: "Payments", permissions: ['listPayments', 'getPayment', 'addPayment', 'updatePayment', 'deletePayment', 'listPaymentHistory', 'generatePaymentReport'] },
  {
    group: "Invoices",
    permissions: [
      'listInvoices',
      'getInvoice',
      'addInvoice',
      'updateInvoice',
      'deleteInvoice',
      'listInvoiceItems',
      'listInvoiceHistory',
      'listInvoiceReceipts',
      'attachInvoiceReceipts',
      'detachInvoiceReceipts',
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
  { group: "Receipts", permissions: ['listReceipts', 'getReceipt', 'addReceipt', 'updateReceipt', 'deleteReceipt', 'listReceiptInvoices', 'listReceiptHistory'] },
  { group: "Reports", permissions: ['listReports', 'getReport', 'listReportHistory', 'createReport', 'updateReport', 'deleteReport'] },
  { group: "Categories", permissions: ['listCategories', 'getCategory', 'addCategory', 'updateCategory', 'deleteCategory', 'listCategoryHistory'] },
  { group: "Providers", permissions: ['listProviders', 'getProvider', 'addProvider', 'updateProvider', 'deleteProvider', 'listProviderHistory'] },
  { group: "Products / Services", permissions: ['listProductsServices', 'getProductService', 'addProductService', 'updateProductService', 'deleteProductService', 'listProductServiceHistory'] },
  { group: "Jobs", permissions: ['listJobs', 'getJob', 'addJob', 'updateJob', 'deleteJob', 'listJobHistory'] },
  { group: "Tariffs", permissions: ['listTariffs', 'getTariff', 'addTariff', 'updateTariff', 'deleteTariff', 'listTariffHistory'] },
  { group: "Appointments", permissions: ['listAppointments', 'getAppointment', 'addAppointment', 'updateAppointment', 'deleteAppointment', 'listAppointmentHistory'] },
  { group: "Accounting Closings", permissions: ['listClosings', 'getClosing', 'addClosing', 'updateClosing', 'deleteClosing', 'listClosingHistory'] },
  { group: "User Profile", permissions: ['listUserProfiles', 'getUserProfile', 'addUserProfile'] },
  { group: "User Configurations", permissions: ['listUserConfigurations', 'getUserConfigurations', 'addUserConfigurations'] },
  { group: "Notifications", permissions: ['listNotifications', 'markNotificationRead', 'markAllNotificationsRead', 'hideNotification', 'sendNotifications'] },
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
  const [permissionsExchangeStatus, setPermissionsExchangeStatus] = useState('Sin actividad');
  const [lastPermissionPostDebug, setLastPermissionPostDebug] = useState<string>('Aún no se envió POST de permisos');
  const [lastPermissionPostResponse, setLastPermissionPostResponse] = useState<string>(
    'Aún no se ha recibido respuesta del POST de permisos',
  );
  const [lastPermissionDeleteResponse, setLastPermissionDeleteResponse] = useState<string>(
    'Aún no se ha recibido respuesta del DELETE de permisos',
  );
  const [lastPermissionsUrl, setLastPermissionsUrl] = useState<string | null>(null);
  const [lastPermissionsResponse, setLastPermissionsResponse] = useState<string | null>(
    'Aún no se ha recibido respuesta de permisos'
  );
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCompanyId, , selectedCompanyHydrated] = useCachedState<number | null>(
    'selected-company-id',
    null,
  );
  const companyIdDebugLabel = useMemo(
    () => (selectedCompanyHydrated ? selectedCompanyId ?? 'null' : 'cargando...'),
    [selectedCompanyHydrated, selectedCompanyId],
  );

  const background = useThemeColor({}, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const groupBorderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');

  const numericUserId = useMemo(() => (userId ? Number(userId) : null), [userId]);
  const userIdDebugLabel = useMemo(
    () => (numericUserId !== null ? numericUserId : 'desconocido'),
    [numericUserId],
  );
  const permissionsRequestLabel = useMemo(
    () => lastPermissionsUrl ?? 'Aún no se ha enviado un GET de permisos',
    [lastPermissionsUrl],
  );
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
    if (!token || selectedUser === null || !canListPermissions || !selectedCompanyHydrated) {
      setAssignedPermissions({});
      setLastPermissionsUrl(null);
      setLastPermissionsResponse('Aún no se ha recibido respuesta de permisos');
      setPermissionsExchangeStatus('Sin actividad');
      return Promise.resolve();
    }

    const isGlobalSelection = selectedUser.id === 0;
    const isOwnSelection = numericUserId !== null && selectedUser.id === numericUserId;
    const companyIdParam = selectedCompanyId ?? 'null';

    if (isGlobalSelection && !canViewGlobalPermissions) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver los permisos globales.');
      setAssignedPermissions({});
      setLastPermissionsUrl(null);
      setLastPermissionsResponse('Acceso denegado para permisos globales');
      setPermissionsExchangeStatus('Sin actividad');
      return Promise.resolve();
    }

    if (!isGlobalSelection && !isOwnSelection && !canSelectOtherUsers) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver los permisos de otros usuarios.');
      setAssignedPermissions({});
      setLastPermissionsUrl(null);
      setLastPermissionsResponse('Acceso denegado para permisos de otros usuarios');
      setPermissionsExchangeStatus('Sin actividad');
      return Promise.resolve();
    }

    setLoading(true);
    const url = isGlobalSelection
      ? `${BASE_URL}/permissions/global?company_id=${companyIdParam}`
      : `${BASE_URL}/permissions/user/${selectedUser.id}?company_id=${companyIdParam}`;

    setLastPermissionsUrl(url);
    setLastPermissionsResponse('Esperando respuesta del servidor...');
    setPermissionsExchangeStatus('Enviado');

    return fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        setLastPermissionsResponse(JSON.stringify(data, null, 2));
        setPermissionsExchangeStatus('Recibido');
        const permissionsMap: Record<string, AssignedPermission> = {};
        data.permissions.forEach((perm: AssignedPermission) => {
          permissionsMap[perm.sector] = perm;
        });
        setAssignedPermissions(permissionsMap);
      })
      .catch(err => {
        console.error('Error loading permissions:', err);
        Alert.alert('Error', 'No se pudieron cargar los permisos.');
        setLastPermissionsResponse('Error al cargar permisos: ' + String(err));
        setPermissionsExchangeStatus('Recibido con error');
      })
      .finally(() => setLoading(false));
  }, [
    canListPermissions,
    canSelectOtherUsers,
    canViewGlobalPermissions,
    numericUserId,
    selectedCompanyHydrated,
    selectedCompanyId,
    selectedUser,
    token,
  ]);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions();
    } else {
      setAssignedPermissions({});
    }
  }, [selectedUser, loadPermissions]);

  // Función para agregar un permiso; se retorna la promesa
  const addPermission = (sector: string) => {
    if (!token || selectedUser === null || !selectedCompanyHydrated) return Promise.resolve();

    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return Promise.resolve();
    }
    const bodyData: any = { sector, company_id: selectedCompanyId ?? null };

    if (selectedUser.id !== 0) {
      bodyData.user_id = selectedUser.id;
    }

    setLastPermissionPostDebug(
      JSON.stringify(
        {
          url: `${BASE_URL}/permissions`,
          body: bodyData,
        },
        null,
        2,
      ),
    );

    setLastPermissionPostResponse('Esperando respuesta del servidor para el POST de permisos...');

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
        setLastPermissionPostResponse(JSON.stringify(data, null, 2));
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
        setLastPermissionPostResponse('Error en POST de permisos: ' + String(err));
      });
  };
  
  // Función para eliminar un permiso; se retorna la promesa
  const removePermission = (sector: string) => {
    if (!token || selectedUser === null || !selectedCompanyHydrated) return Promise.resolve();

    if (!canEditSelection) {
      Alert.alert('Acceso denegado', 'No tienes permiso para modificar estos permisos.');
      return Promise.resolve();
    }
    const perm = assignedPermissions[sector];
    if (!perm) return Promise.resolve();
    const companyIdParam = selectedCompanyId ?? 'null';

    setLastPermissionDeleteResponse('Esperando respuesta del servidor para el DELETE de permisos...');

    return fetch(`${BASE_URL}/permissions/${perm.id}?company_id=${companyIdParam}`, {
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
      .then((data) => {
        setLastPermissionDeleteResponse(JSON.stringify(data, null, 2));
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
        setLastPermissionDeleteResponse('Error en DELETE de permisos: ' + String(err));
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
      <ThemedText style={styles.infoText}>
        company_id (selectedCompanyId) enviado al servidor: {companyIdDebugLabel}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        ID de usuario autenticado: {userIdDebugLabel}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        POST de permisos enviado al servidor (con body): {'\n'}{lastPermissionPostDebug}
      </ThemedText>
      <ThemedText style={[styles.infoText, styles.responseText]}>
        Respuesta del POST de permisos: {'\n'}{lastPermissionPostResponse}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        GET de permisos enviado al servidor: {permissionsRequestLabel}
      </ThemedText>
      <ThemedText style={[styles.infoText, styles.responseText]}>
        Respuesta del DELETE de permisos: {'\n'}{lastPermissionDeleteResponse}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        Estado del intercambio de permisos: {permissionsExchangeStatus}
      </ThemedText>
      <ThemedText style={[styles.infoText, styles.responseText]}>
        Respuesta del servidor: {'\n'}{lastPermissionsResponse ?? 'Sin respuesta del servidor'}
      </ThemedText>
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
    marginTop: 20,
  },
  responseText: {
    fontFamily: 'monospace',
    textAlign: 'left',
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
