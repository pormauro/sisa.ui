declare module '@/src/database/syncQueueDB' {
  export function createSyncQueueTable(): Promise<void>;
  export function enqueueOperation(
    tableName: string,
    op: string,
    payload: any,
    recordId?: number | null,
    localTempId?: number | null
  ): Promise<number | null>;
  export function getAllQueueItems(): Promise<any[]>;
  export function updateQueueItemStatus(
    id: number,
    status: string,
    lastError?: string | null
  ): Promise<void>;
  export function deleteQueueItem(id: number): Promise<void>;
}
