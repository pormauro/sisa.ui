import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLedger } from '@/hooks/useLedger';

const LedgerScreen = () => {
  const { ledgers, loadLedger, loadingAccountId } = useLedger();
  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (accountId) {
      void loadLedger(Number(accountId));
    }
  }, [accountId, loadLedger]);

  const rows = accountId ? ledgers[Number(accountId)] ?? [] : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mayor por cuenta</Text>
      <TextInput
        placeholder="ID de cuenta"
        value={accountId}
        onChangeText={setAccountId}
        style={styles.input}
        keyboardType="numeric"
      />
      {loadingAccountId === Number(accountId) && <Text>Cargando mayor...</Text>}
      {rows.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.cell}>{item.date}</Text>
          <Text style={styles.cell}>D: {item.debit}</Text>
          <Text style={styles.cell}>H: {item.credit}</Text>
          <Text style={styles.cell}>Saldo: {item.balance}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  cell: { fontSize: 14 },
});

export default LedgerScreen;
