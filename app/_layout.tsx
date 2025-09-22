import { AuthContext, AuthProvider } from '@/contexts/AuthContext';
import { CashBoxesProvider } from '@/contexts/CashBoxesContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { ClientsProvider } from '@/contexts/ClientsContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { FilesProvider } from '@/contexts/FilesContext';
import { FoldersProvider } from '@/contexts/FoldersContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { AppointmentsProvider } from '@/contexts/AppointmentsContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PaymentsProvider } from '@/contexts/PaymentsContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ProductsServicesProvider } from '@/contexts/ProductsServicesContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ProfilesProvider } from '@/contexts/ProfilesContext';
import { ProfilesListProvider } from '@/contexts/ProfilesListContext';
import { ProvidersProvider } from '@/contexts/ProvidersContext';
import { ReceiptsProvider } from '@/contexts/ReceiptsContext';
import { StatusesProvider } from '@/contexts/StatusesContext';
import { TariffsProvider } from '@/contexts/TariffsContext';
import { PendingSelectionProvider } from '@/contexts/PendingSelectionContext';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemeProvider } from '@/components/ThemeProvider';
import { LogOverlay } from '@/components/LogOverlay';
import { useThemeColor } from '@/hooks/useThemeColor';
import { LogProvider } from '@/contexts/LogContext';

function RootLayoutContent() {
  const { isLoading, username } = useContext(AuthContext);
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!isLoading) {
      if (username) {
        router.replace('/Home');
      } else {
        router.replace('/login/Login');
      }
    }
  }, [isLoading, username]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { paddingTop: 30, paddingBottom: 30 },
      }}
    >
      <Stack.Screen name="Index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="Home" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <FilesProvider>
          <ProfileProvider>
            <ProfilesProvider>
              <ProfilesListProvider>
                <ConfigProvider>
                  <ThemeProvider>
                    <LogProvider>
                      <CashBoxesProvider>
                        <ClientsProvider>
                          <ProvidersProvider>
                            <CategoriesProvider>
                              <ProductsServicesProvider>
                                <StatusesProvider>
                                  <TariffsProvider>
                                    <JobsProvider>
                                      <NotificationsProvider>
                                        <AppointmentsProvider>
                                          <PaymentsProvider>
                                          <ReceiptsProvider>
                                            <FoldersProvider>
                                              <PendingSelectionProvider>
                                                <>
                                                  <RootLayoutContent />
                                                  <LogOverlay />
                                                </>
                                              </PendingSelectionProvider>
                                            </FoldersProvider>
                                          </ReceiptsProvider>
                                          </PaymentsProvider>
                                        </AppointmentsProvider>
                                      </NotificationsProvider>
                                    </JobsProvider>
                                  </TariffsProvider>
                                </StatusesProvider>
                              </ProductsServicesProvider>
                            </CategoriesProvider>
                          </ProvidersProvider>
                        </ClientsProvider>
                      </CashBoxesProvider>
                    </LogProvider>
                  </ThemeProvider>
                </ConfigProvider>
              </ProfilesListProvider>
            </ProfilesProvider>
          </ProfileProvider>
        </FilesProvider>
      </PermissionsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
