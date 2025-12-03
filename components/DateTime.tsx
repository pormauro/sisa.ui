// @/components/DataTime.tsx
import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toMySQLDateTime } from '@/utils/date';

// Recibe una prop 'onDateChange' para informar al padre la fecha elegida
export default function MyDatePicker({
  label,
  onDateChange,
}: {
  label: string;
  onDateChange: (dateString: string) => void;
}) {
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);

  // Guardamos la cadena MySQL para mostrarla en pantalla
  const [mysqlDate, setMysqlDate] = useState('');

  const onChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShow(false);
    setDate(currentDate);
    const dateStr = toMySQLDateTime(currentDate);
    setMysqlDate(dateStr);
    onDateChange(dateStr); // <-- Avisamos al padre
  };

  return (
    <View style={{ marginVertical: 10 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>{label}</Text>
      <Button title="Seleccionar Fecha/Hora" onPress={() => setShow(true)} />
      <Text style={{ marginTop: 8 }}>
        {mysqlDate ? `Seleccionado: ${mysqlDate}` : '(Nada aún)'}
      </Text>

      {show && (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="default"
          onChange={onChange}
        />
      )}
    </View>
  );
}
