// src/screens/ErrorLogsList.js
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { clearErrorLogs, getErrorLogs } from '../../src/database/errorLogger';

export default function ErrorLogsList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const fetchedLogs = await getErrorLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para limpiar todos los logs y recargar la lista
  const handleClearLogs = async () => {
    await clearErrorLogs();
    loadLogs();
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.logItem}>
      <Text style={styles.timestamp}>{item.timestamp}</Text>
      <Text style={styles.errorMessage}>{item.error_message}</Text>
      {item.error_stack ? <Text style={styles.errorStack}>{item.error_stack}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Error Logs</Text>
      <TouchableOpacity style={styles.clearButton} onPress={handleClearLogs}>
        <Text style={styles.clearButtonText}>Limpiar logs</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={<Text>No hay registros de errores.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  loader: { 
    marginTop: 20,
  },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  errorMessage: {
    fontSize: 16,
    color: '#c00',
    marginTop: 4,
  },
  errorStack: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
