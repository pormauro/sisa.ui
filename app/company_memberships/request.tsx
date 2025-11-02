import React, { useContext, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

const RequestCompanyMembershipAccessScreen: React.FC = () => {
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#dedede', dark: '#444' }, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');

  useEffect(() => {
    if (permissions.includes('listCompanyMemberships')) {
      router.replace('/company_memberships');
    }
  }, [permissions, router]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}> 
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { borderColor }]}> 
          <ThemedText style={styles.title}>Solicitar acceso a una empresa</ThemedText>
          <ThemedText style={styles.description}>
            {'Para continuar con tus gestiones necesitás que un administrador apruebe tu acceso a una empresa. '}
            {'Seleccioná la empresa correspondiente y enviá tu solicitud desde los canales habilitados por tu organización.'}
          </ThemedText>
          <ThemedText style={styles.hint}>
            Una vez aprobado el acceso, verás automáticamente el módulo de membresías y podrás administrar tus vínculos sin volver a iniciar sesión.
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => router.push('/Home')}
          >
            <ThemedText style={[styles.buttonLabel, { color: buttonTextColor }]}>
              Volver al menú principal
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RequestCompanyMembershipAccessScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'justify',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
