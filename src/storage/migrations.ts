import type { DbSnapshot } from '../types';
import { SEED_REASON_TAGS } from './seedTags';

export const CURRENT_SCHEMA_VERSION = 1;

type RawDb = Partial<Omit<DbSnapshot, 'schemaVersion'>>;

// Each entry upgrades a raw snapshot from (version - 1) to version.
const migrations: Record<number, (raw: RawDb) => RawDb> = {
  1: (raw) => ({
    profiles: raw.profiles ?? [],
    items: raw.items ?? [],
    reasonTags:
      raw.reasonTags && raw.reasonTags.length > 0
        ? raw.reasonTags
        : [...SEED_REASON_TAGS],
  }),
};

export function runMigrations(raw: RawDb, fromVersion: number): DbSnapshot {
  let current: RawDb = { ...raw };
  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) {
      throw new Error(`Missing migration for schema version ${v}`);
    }
    current = migrate(current);
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: current.profiles ?? [],
    items: current.items ?? [],
    reasonTags: current.reasonTags ?? [],
  };
}
