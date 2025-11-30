import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogOverlay } from '@/components/LogOverlay';
import { useThemeColor } from '@/hooks/useThemeColor';
import { LogProvider } from '@/contexts/LogContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppUpdatesProvider } from '@/contexts/AppUpdatesContext';
import { BottomBubbleBar } from '@/components/BottomBubbleBar';
import { AuthContext, AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider, useCompanyContext } from '@/contexts/CompanyContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { FilesProvider } from '@/contexts/FilesContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ProfilesProvider } from '@/contexts/ProfilesContext';
import { ProfilesListProvider } from '@/contexts/ProfilesListContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { CashBoxesProvider } from '@/contexts/CashBoxesContext';
import { ClientsProvider } from '@/contexts/ClientsContext';
import { ProvidersProvider } from '@/contexts/ProvidersContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { ProductsServicesProvider } from '@/contexts/ProductsServicesContext';
import { StatusesProvider } from '@/contexts/StatusesContext';
import { TariffsProvider } from '@/contexts/TariffsContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { AppointmentsProvider } from '@/contexts/AppointmentsContext';
import { PaymentTemplatesProvider } from '@/contexts/PaymentTemplatesContext';
import { PaymentsProvider } from '@/contexts/PaymentsContext';
import { InvoicesProvider } from '@/contexts/InvoicesContext';
import { ReceiptsProvider } from '@/contexts/ReceiptsContext';
import { ReportsProvider } from '@/contexts/ReportsContext';
import { FoldersProvider } from '@/contexts/FoldersContext';
import { CommentsProvider } from '@/contexts/CommentsContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PendingSelectionProvider } from '@/contexts/PendingSelectionContext';
import { ThemeProvider } from '@/components/ThemeProvider';

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
  }, [isLoading, router, username]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  return (
    <View style={[styles.contentContainer, { backgroundColor }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { paddingTop: 30, paddingBottom: 110 },
        }}
      >
        <Stack.Screen name="Index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="Home" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <BottomBubbleBar />
    </View>
  );
}

function CompanyBoundProviders({ children }: { children: React.ReactNode }) {
  const { activeCompany } = useCompanyContext();

  return (
    <PermissionsProvider key={activeCompany?.id ?? 'no-company'}>
      <AppUpdatesProvider>
        <FilesProvider>
          <ProfileProvider>
            <ProfilesProvider>
              <ProfilesListProvider>
                <LogProvider>
                  <ToastProvider>
                    <CashBoxesProvider>
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
                                                  <CommentsProvider>
                                                    <NotificationsProvider>
                                                      <PendingSelectionProvider>
                                                        {children}
                                                      </PendingSelectionProvider>
                                                    </NotificationsProvider>
                                                  </CommentsProvider>
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
                    </CashBoxesProvider>
                  </ToastProvider>
                </LogProvider>
              </ProfilesListProvider>
            </ProfilesProvider>
          </ProfileProvider>
        </FilesProvider>
      </AppUpdatesProvider>
    </PermissionsProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CompanyProvider>
          <ConfigProvider>
            <ThemeProvider>
              <CompanyBoundProviders>
                <>
                  <RootLayoutContent />
                  <LogOverlay />
                </>
              </CompanyBoundProviders>
            </ThemeProvider>
          </ConfigProvider>
        </CompanyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
});
