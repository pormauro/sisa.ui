import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'max_history_id';

export async function getMaxHistoryId(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(HISTORY_KEY);
    return value !== null ? parseInt(value, 10) : null;
  } catch {
    return null;
  }
}

export async function setMaxHistoryId(id: number): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, id.toString());
  } catch {
    // ignore write errors
  }
}

