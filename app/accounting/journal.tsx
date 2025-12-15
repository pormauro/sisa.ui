import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useJournalEntries } from '@/hooks/useJournalEntries';

const JournalScreen = () => {
  const { entries, refresh } = useJournalEntries();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Asientos contables</Text>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <Text style={styles.subtitle}>{entry.date}</Text>
          <Text style={styles.memo}>{entry.memo}</Text>
          {entry.items.map((item, idx) => (
            <View style={styles.row} key={`${entry.id}-${idx}`}>
              <Text style={styles.cell}>Cuenta: {item.account_id}</Text>
              <Text style={styles.cell}>D: {item.debit}</Text>
              <Text style={styles.cell}>H: {item.credit}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  memo: { marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, elevation: 1, shadowOpacity: 0.1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { flex: 1 },
});

export default JournalScreen;
