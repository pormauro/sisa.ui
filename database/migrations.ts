import {
  SCHEMA_VERSION,
  CREATE_TABLE_FILES,
  CREATE_INDEX_FILES_DOWNLOADED,
  CREATE_TABLE_ENTITY_FILES,
  CREATE_INDEX_ENTITY_FILES,
} from './schema';

export type Migration = {
  version: number;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      CREATE_TABLE_FILES,
      CREATE_INDEX_FILES_DOWNLOADED,
      CREATE_TABLE_ENTITY_FILES,
      CREATE_INDEX_ENTITY_FILES,
    ],
  },
];

export { SCHEMA_VERSION };
