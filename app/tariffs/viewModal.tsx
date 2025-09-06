import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { TariffsContext } from '@/contexts/TariffsContext';

export default function ViewTariffModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tariffId = Number(id);
  const router = useRouter();
  const { tariffs } = useContext(TariffsContext);

  const tariff = tariffs.find(t => t.id === tariffId);

  if (!tariff) {
    return (
      <View style={styles.container}>
        <Text>Tarifa no encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <Text style={styles.value}>{tariff.name}</Text>

      <Text style={styles.label}>Monto</Text>
      <Text style={styles.value}>{tariff.amount}</Text>

      <Text style={styles.label}>Última actualización</Text>
      <Text style={styles.value}>{tariff.last_update}</Text>

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{tariff.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/tariffs/${tariff.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
