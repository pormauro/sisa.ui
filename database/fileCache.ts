import { SQLResultSetRowList } from 'expo-sqlite/next';
import { getDatabase } from './sqlite';

export type CachedFileRecord = {
  id: number;
  name: string;
  mime: string;
  size: number;
  checksum?: string | null;
  localPath?: string | null;
  downloaded: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type FileRelation = {
  entityType: string;
  entityId: number;
  fileId: number;
  position?: number | null;
};

const mapRowToRecord = (row: SQLResultSetRowList[number]): CachedFileRecord => ({
  id: row.id as number,
  name: (row.name as string) || '',
  mime: (row.mime as string) || 'application/octet-stream',
  size: Number(row.size) || 0,
  checksum: (row.checksum as string) ?? null,
  localPath: (row.local_path as string) ?? null,
  downloaded: Boolean(row.downloaded),
  createdAt: (row.created_at as string) ?? null,
  updatedAt: (row.updated_at as string) ?? null,
});

export const upsertFileMetadata = async (record: CachedFileRecord): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO files (id, name, mime, size, checksum, local_path, downloaded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       mime=excluded.mime,
       size=excluded.size,
       checksum=excluded.checksum,
       local_path=excluded.local_path,
       downloaded=excluded.downloaded,
       created_at=COALESCE(excluded.created_at, files.created_at),
       updated_at=excluded.updated_at;`,
    [
      record.id,
      record.name,
      record.mime,
      record.size,
      record.checksum ?? null,
      record.localPath ?? null,
      record.downloaded ? 1 : 0,
      record.createdAt ?? null,
      record.updatedAt ?? null,
    ]
  );
};

export const markFileAsDownloaded = async (
  fileId: number,
  localPath: string,
  checksum?: string | null,
  updatedAt?: string | null
): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE files
     SET downloaded = 1,
         local_path = ?,
         checksum = COALESCE(?, checksum),
         updated_at = COALESCE(?, updated_at)
     WHERE id = ?;`,
    [localPath, checksum ?? null, updatedAt ?? null, fileId]
  );
};

export const markFileAsMissing = async (fileId: number): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE files SET downloaded = 0, local_path = NULL WHERE id = ?;',
    [fileId]
  );
};

export const getFileMetadata = async (fileId: number): Promise<CachedFileRecord | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT id, name, mime, size, checksum, local_path, downloaded, created_at, updated_at FROM files WHERE id = ?;',
    [fileId]
  );
  return row ? mapRowToRecord(row) : null;
};

export const getFilesForEntity = async (
  entityType: string,
  entityId: number
): Promise<CachedFileRecord[]> => {
  const db = await getDatabase();
  const result = await db.getAllAsync(
    `SELECT f.id, f.name, f.mime, f.size, f.checksum, f.local_path, f.downloaded, f.created_at, f.updated_at
     FROM files f
     INNER JOIN entity_files ef ON ef.file_id = f.id
     WHERE ef.entity_type = ? AND ef.entity_id = ?
     ORDER BY ef.position ASC, f.id ASC;`,
    [entityType, entityId]
  );
  return result.map(mapRowToRecord);
};

export const upsertEntityRelations = async (relations: FileRelation[]): Promise<void> => {
  if (relations.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const rel of relations) {
      await db.runAsync(
        `INSERT INTO entity_files (entity_type, entity_id, file_id, position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(entity_type, entity_id, file_id) DO UPDATE SET position = excluded.position;`,
        [rel.entityType, rel.entityId, rel.fileId, rel.position ?? null]
      );
    }
  });
};

export const removeAllFiles = async (): Promise<CachedFileRecord[]> => {
  const db = await getDatabase();
  const existing = await db.getAllAsync(
    'SELECT id, name, mime, size, checksum, local_path, downloaded, created_at, updated_at FROM files;'
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM entity_files;');
    await db.runAsync('DELETE FROM files;');
  });
  return existing.map(mapRowToRecord);
};
