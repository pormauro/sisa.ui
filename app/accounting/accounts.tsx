import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccounts } from '@/hooks/useAccounts';

const AccountRow: React.FC<{ name: string; code: string; level: number }> = ({ name, code, level }) => (
  <View style={[styles.row, { paddingLeft: 10 + level * 12 }]}>
    <Text style={styles.code}>{code}</Text>
    <Text>{name}</Text>
  </View>
);

const AccountsScreen = () => {
  const { accounts, refresh } = useAccounts();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  const levels = new Map<number, number>();
  sorted.forEach((account) => {
    const parentLevel = account.parent_id ? levels.get(account.parent_id) ?? 0 : 0;
    levels.set(account.id, parentLevel + 1);
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Plan de cuentas</Text>
      {sorted.map((account) => (
        <AccountRow
          key={account.id}
          code={account.code}
          name={account.name}
          level={(levels.get(account.id) ?? 1) - 1}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  code: { fontWeight: 'bold', width: 80 },
});

export default AccountsScreen;
