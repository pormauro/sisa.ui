import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccountingReports } from '@/hooks/useAccountingReports';

const BalanceScreen = () => {
  const { balance, refresh, loading } = useAccountingReports();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Balance general</Text>
      {loading && <Text>Cargando...</Text>}
      <View style={styles.card}>
        <Text>{JSON.stringify(balance, null, 2)}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, elevation: 1 },
});

export default BalanceScreen;
