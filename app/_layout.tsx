import '@/utils/networkSniffer';

import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { BottomNavigationBar } from '@/components/BottomNavigationBar';
import { AuthContext, AuthProvider } from '@/contexts/AuthContext';
import { CashBoxesProvider } from '@/contexts/CashBoxesContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { ClientsProvider } from '@/contexts/ClientsContext';
import { CompaniesProvider } from '@/contexts/CompaniesContext';
import { MemberCompaniesProvider } from '@/contexts/MemberCompaniesContext';
import { CompanyMembershipsProvider } from '@/contexts/CompanyMembershipsContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { FilesProvider } from '@/contexts/FilesContext';
import { FoldersProvider } from '@/contexts/FoldersContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { AppointmentsProvider } from '@/contexts/AppointmentsContext';
import { PaymentsProvider } from '@/contexts/PaymentsContext';
import { InvoicesProvider } from '@/contexts/InvoicesContext';
import { PaymentTemplatesProvider } from '@/contexts/PaymentTemplatesContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ProductsServicesProvider } from '@/contexts/ProductsServicesContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ProfilesProvider } from '@/contexts/ProfilesContext';
import { ProfilesListProvider } from '@/contexts/ProfilesListContext';
import { ProvidersProvider } from '@/contexts/ProvidersContext';
import { ReceiptsProvider } from '@/contexts/ReceiptsContext';
import { ReportsProvider } from '@/contexts/ReportsContext';
import { StatusesProvider } from '@/contexts/StatusesContext';
import { TariffsProvider } from '@/contexts/TariffsContext';
import { PendingSelectionProvider } from '@/contexts/PendingSelectionContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';

import { ThemeProvider } from '@/components/ThemeProvider';
import { LogOverlay } from '@/components/LogOverlay';
import { useThemeColor } from '@/hooks/useThemeColor';
import { LogProvider } from '@/contexts/LogContext';
import { NetworkLogProvider } from '@/contexts/NetworkLogContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppUpdatesProvider } from '@/contexts/AppUpdatesContext';
import { primeMemoryCacheFromStorage } from '@/hooks/useCachedState';

void SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isLoading, username } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
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
  }, [isLoading, router, username]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  const showBottomNavigation = Boolean(username) && pathname !== '/login/Login';
  const contentBottomPadding = showBottomNavigation ? 30 + insets.bottom : insets.bottom;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { paddingTop: 30, paddingBottom: contentBottomPadding },
        }}
      >
        <Stack.Screen name="Index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="Home" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {showBottomNavigation ? <BottomNavigationBar /> : null}
    </>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          primeMemoryCacheFromStorage(),
          Font.loadAsync({
            ...Ionicons.font,
            ...MaterialIcons.font,
            ...MaterialCommunityIcons.font,
          }),
        ]);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    };

    void initializeApp();
  }, []);

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <LogProvider>
      <NetworkLogProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <PermissionsProvider>
              <AppUpdatesProvider>
                <FilesProvider>
                  <ProfileProvider>
                    <ProfilesProvider>
                      <ProfilesListProvider>
                        <ConfigProvider>
                          <ThemeProvider>
                            <ToastProvider>
                              <CashBoxesProvider>
                                <CompaniesProvider>
                                  <MemberCompaniesProvider>
                                    <CompanyMembershipsProvider>
                                      <ClientsProvider>
                                        <ProvidersProvider>
                                          <CategoriesProvider>
                                            <ProductsServicesProvider>
                                              <StatusesProvider>
                                                <TariffsProvider>
                                                  <JobsProvider>
                                                    <AppointmentsProvider>
                                                      <PaymentTemplatesProvider>
                                                        <PaymentsProvider>
                                                          <InvoicesProvider>
                                                            <ReceiptsProvider>
                                                              <ReportsProvider>
                                                                <FoldersProvider>
                                                                  <NotificationsProvider>
                                                                    <PendingSelectionProvider>
                                                                      <>
                                                                        <RootLayoutContent />
                                                                        <LogOverlay />
                                                                      </>
                                                                    </PendingSelectionProvider>
                                                                  </NotificationsProvider>
                                                                </FoldersProvider>
                                                              </ReportsProvider>
                                                            </ReceiptsProvider>
                                                          </InvoicesProvider>
                                                        </PaymentsProvider>
                                                      </PaymentTemplatesProvider>
                                                    </AppointmentsProvider>
                                                  </JobsProvider>
                                                </TariffsProvider>
                                              </StatusesProvider>
                                            </ProductsServicesProvider>
                                          </CategoriesProvider>
                                        </ProvidersProvider>
                                      </ClientsProvider>
                                    </CompanyMembershipsProvider>
                                  </MemberCompaniesProvider>
                                </CompaniesProvider>
                              </CashBoxesProvider>
                            </ToastProvider>
                          </ThemeProvider>
                        </ConfigProvider>
                      </ProfilesListProvider>
                    </ProfilesProvider>
                  </ProfileProvider>
                </FilesProvider>
              </AppUpdatesProvider>
            </PermissionsProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </NetworkLogProvider>
    </LogProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
