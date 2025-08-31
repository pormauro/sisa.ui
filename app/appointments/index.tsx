import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import SchedulePicker from '@/components/SchedulePicker';

export default function SchedulePickerTestScreen() {
  // State to hold JSON output
  const [dataJson, setDataJson] = useState<string>('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>SchedulePicker Test</Text>

        <SchedulePicker
          initialDataJson={dataJson}
          onChange={json => {
            console.log('Schedule JSON:', json);
            setDataJson(json);
          }}
        />

        <View style={styles.outputContainer}>
          <Text style={styles.outputHeader}>Current JSON:</Text>
          <Text style={styles.outputText}>{dataJson || '(empty)'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16 },
  header: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  outputContainer: { marginTop: 24, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8 },
  outputHeader: { fontWeight: '500', marginBottom: 6 },
  outputText: { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },
});
