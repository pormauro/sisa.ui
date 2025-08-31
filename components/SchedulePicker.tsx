// C:/Users/Mauri/Documents/GitHub/router/components/SchedulePicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { calculateTimeDifference } from '@/config/Utils';

interface TimeRange {
  id: string;
  start: Date;
  end: Date | null;
  comment: string;
}
interface DateGroup {
  id: string;
  date: Date;
  comment: string;
  ranges: TimeRange[];
}

interface SchedulePickerProps {
  initialDataJson?: string;
  onChange?: (dataJson: string) => void;
}

export default function SchedulePicker({
  initialDataJson,
  onChange,
}: SchedulePickerProps) {
  // 1) Helper para parsear el JSON inicial
  const parseInitial = (): DateGroup[] => {
    try {
      if (!initialDataJson) return [];
      const raw = JSON.parse(initialDataJson) as any[];
      return raw.map((g) => ({
        id: g.date,
        date: new Date(g.date),
        comment: g.comment || '',
        ranges: g.ranges.map((r: any) => ({
          id: `${g.date}-${r.start}`,
          start: new Date(r.start),
          end: r.end ? new Date(r.end) : null,
          comment: r.comment || '',
        })),
      }));
    } catch {
      return [];
    }
  };

  // 2) Estado interno, inicializado perezosamente
  const [groups, setGroups] = useState<DateGroup[]>(() => parseInitial());

  // 3) Refs para controlar disparos
  const initialLoadRef = useRef(true);
  const lastInitialJsonRef = useRef(initialDataJson);

  // 4) Si el padre realmente manda otro initialDataJson distinto, reparseamos (una sola vez)
  useEffect(() => {
    if (
      initialDataJson &&
      initialDataJson !== lastInitialJsonRef.current
    ) {
      lastInitialJsonRef.current = initialDataJson;
      setGroups(parseInitial());
    }
  }, [initialDataJson]);

  // 5) Disparamos onChange solo después de la carga inicial
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (!onChange) return;
    const serial = groups.map((g) => ({
      date: g.date.toISOString(),
      comment: g.comment,
      ranges: g.ranges.map((r) => ({
        start: r.start.toISOString(),
        end: r.end?.toISOString() || null,
        comment: r.comment,
      })),
    }));
    onChange(JSON.stringify(serial));
  }, [groups]);

  // — CRUD interno —
  const addDateGroup = () => {
    const now = new Date();
    setGroups((prev) => [
      ...prev,
      { id: `${now.getTime()}`, date: now, comment: '', ranges: [] },
    ]);
  };
  const removeDateGroup = (id: string) =>
    setGroups((prev) => prev.filter((g) => g.id !== id));
  const addTimeRange = (groupId: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          :  {
            ...g,
            ranges: [
              ...g.ranges,
              {
                id: `${groupId}-${Date.now()}`,
                start: new Date(),
                end: null,
                comment: '',
              },
            ],
          }
      )
    );

  const removeTimeRange = (groupId: string, rangeId: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, ranges: g.ranges.filter((r) => r.id !== rangeId) }
      )
    );
  const updateGroupComment = (groupId: string, text: string) =>
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, comment: text } : g))
    );
  const updateRangeComment = (
    groupId: string,
    rangeId: string,
    text: string
  ) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              ranges: g.ranges.map((r) =>
                r.id === rangeId ? { ...r, comment: text } : r
              ),
            }
      )
    );

  // — DateTimePicker —
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeRangeId, setActiveRangeId] = useState<string | null>(null);
  const [pickerField, setPickerField] = useState<
    'groupDate' | 'rangeStart' | 'rangeEnd'
  >('groupDate');

  const openPicker = (
    field: 'groupDate' | 'rangeStart' | 'rangeEnd',
    groupId: string,
    rangeId?: string
  ) => {
    setPickerField(field);
    setActiveGroupId(groupId);
    setActiveRangeId(rangeId || null);
    setPickerMode(field === 'groupDate' ? 'date' : 'time');
    setPickerVisible(true);
  };
  const getPickerValue = (): Date => {
    if (!activeGroupId) return new Date();
    const grp = groups.find((g) => g.id === activeGroupId)!;
    if (pickerField === 'groupDate') return grp.date;
    const rng = grp.ranges.find((r) => r.id === activeRangeId!)!;
    return pickerField === 'rangeStart' ? rng.start : rng.end || new Date();
  };
  const onPickerChange = (_: any, sel?: Date) => {
    setPickerVisible(Platform.OS === 'ios');
    if (!sel || !activeGroupId) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroupId) return g;
        if (pickerField === 'groupDate') return { ...g, date: sel };
        return {
          ...g,
          ranges: g.ranges.map((r) =>
            r.id !== activeRangeId
              ? r
              : pickerField === 'rangeStart'
              ? { ...r, start: sel }
              : { ...r, end: sel }
          ),
        };
      })
    );
  };

  // — Render —
  const renderRange = (groupId: string) => ({ item }: { item: TimeRange }) => {
    const diff = item.end
      ? calculateTimeDifference(item.start, item.end)
      : { hours: 0, minutes: 0 };
    return (
      <View style={styles.rangeContainer}>
        <View style={styles.rangeRow}>
          <TouchableOpacity
            onPress={() => openPicker('rangeStart', groupId, item.id)}
            style={styles.timeBtn}
          >
            <Text>{item.start.toLocaleTimeString()}</Text>
          </TouchableOpacity>
          <Text>–</Text>
          <TouchableOpacity
            onPress={() => openPicker('rangeEnd', groupId, item.id)}
            style={styles.timeBtn}
          >
            <Text>
              {item.end ? item.end.toLocaleTimeString() : 'Finalizar'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.diffText}>
            {diff.hours}h {diff.minutes}m
          </Text>
          <TouchableOpacity onPress={() => removeTimeRange(groupId, item.id)}>
            <Text style={styles.deleteText}> Eliminar</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.commentSmall}
          placeholder="Comentario rango horario..."
          value={item.comment}
          onChangeText={(t) => updateRangeComment(groupId, item.id, t)}
        />
      </View>
    );
  };

  const renderGroup = ({ item }: { item: DateGroup }) => (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <TouchableOpacity
          onPress={() => openPicker('groupDate', item.id)}
          style={styles.dateBtn}
        >
          <Text style={styles.dateText}>
            {item.date.toLocaleDateString()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeDateGroup(item.id)}>
          <Text style={styles.deleteText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.comment}
        placeholder="Comentario fecha..."
        value={item.comment}
        onChangeText={(t) => updateGroupComment(item.id, t)}
      />
      <FlatList
        nestedScrollEnabled
        data={item.ranges}
        keyExtractor={(r) => r.id}
        renderItem={renderRange(item.id)}
      />
      <TouchableOpacity
        onPress={() => addTimeRange(item.id)}
        style={styles.addRangeBtn}
      >
        <Text style={styles.addRange}>+ Nuevo Horario</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={renderGroup}
      />
      <TouchableOpacity onPress={addDateGroup} style={styles.addDateBtn}>
        <Text style={styles.addDate}>+ Nueva Fecha</Text>
      </TouchableOpacity>
      {pickerVisible && (
        <DateTimePicker
          value={getPickerValue()}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8 },
  addDateBtn: {
    margin: 12,
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addDate: { color: '#fff', fontWeight: '600' },
  addRange: { color: '#00f', fontWeight: '600' },
  groupCard: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBtn: { padding: 6, borderWidth: 1, borderColor: '#ccc', borderRadius: 6 },
  dateText: { fontWeight: '600' },
  deleteText: { color: 'red' },
  comment: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#fff',
  },
  rangeContainer: { marginTop: 8 },
  rangeRow: { flexDirection: 'row', alignItems: 'center' },
  timeBtn: {
    padding: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  diffText: { marginLeft: 8 },
  commentSmall: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 4,
    backgroundColor: '#fff',
  },
  addRangeBtn: { marginTop: 8, alignSelf: 'flex-end' },
});
