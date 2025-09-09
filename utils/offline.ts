export interface OfflineRecord {
  id: number;
  syncStatus?: 'pending' | 'error';
  pendingDelete?: boolean;
}

/**
 * Merge local database items with in-memory pending items.
 * Pending items (negative id, syncStatus 'pending', or pendingDelete) are preserved.
 * Pending deletions remove matching local items.
 */
export function mergeOfflineData<T extends OfflineRecord>(localData: T[], current: T[]): T[] {
  const pending = current.filter(
    item => item.id < 0 || item.syncStatus === 'pending' || item.pendingDelete
  );
  const localMap = new Map(localData.map(item => [item.id, item]));
  const merged: T[] = [];

  for (const item of localData) {
    const match = pending.find(p => p.id === item.id);
    if (match) {
      if (!match.pendingDelete) {
        merged.push({ ...item, ...match });
      }
    } else {
      merged.push(item);
    }
  }

  for (const p of pending) {
    if (p.id < 0 || !localMap.has(p.id)) {
      if (!p.pendingDelete) {
        merged.push(p);
      }
    }
  }

  return merged;
}
