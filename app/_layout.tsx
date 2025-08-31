import { AuthContext, AuthProvider } from '@/contexts/AuthContext';
import { CashBoxesProvider } from '@/contexts/CashBoxesContext';
import { ClientsProvider } from '@/contexts/ClientsContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { FilesProvider } from '@/contexts/FilesContext';
import { FoldersProvider } from '@/contexts/FoldersContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ProductsServicesProvider } from '@/contexts/ProductsServicesContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { StatusesProvider } from '@/contexts/StatusesContext';
import { TariffsProvider } from '@/contexts/TariffsContext';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';


function RootLayoutContent() {
  const { isLoading, username } = useContext(AuthContext);
  const router = useRouter();

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
            <ConfigProvider>
              <CashBoxesProvider>
                <ClientsProvider>
                  <ProductsServicesProvider>
                    <StatusesProvider>
                      <TariffsProvider>
                        <JobsProvider>
                          <FoldersProvider>
                            <RootLayoutContent />
                          </FoldersProvider>
                        </JobsProvider>
                      </TariffsProvider>
                    </StatusesProvider>
                  </ProductsServicesProvider>
                </ClientsProvider>
              </CashBoxesProvider>
            </ConfigProvider>
          </ProfileProvider>
        </FilesProvider>
      </PermissionsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#2f273e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
