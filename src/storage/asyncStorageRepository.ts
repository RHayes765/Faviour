import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  DbSnapshot,
  Item,
  NewItemInput,
  NewProfileInput,
  Profile,
} from '../types';
import { dedupeTags } from '../utils/tags';
import { newId } from './ids';
import { mergeSnapshots } from './merge';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations';
import type {
  FaviourRepository,
  ImportMode,
  ImportOptions,
  Tombstone,
} from './repository';

const KEYS = {
  meta: '@faviour:meta',
  profiles: '@faviour:profiles',
  items: '@faviour:items',
  tags: '@faviour:tags',
} as const;

export const PRE_IMPORT_BACKUP_KEY = '@faviour:pre-import-backup';
export const TOMBSTONES_KEY = '@faviour:tombstones';
const TOMBSTONE_CAP = 500;

function parseJson<T>(raw: string | null | undefined, key: string): T | undefined {
  if (raw == null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    // Never silently discard existing (corrupt) data — the next persist would
    // overwrite it. Park the raw payload for manual recovery and continue.
    console.warn(`Corrupt data under ${key}; backing up raw payload`, e);
    void AsyncStorage.setItem(`${key}:corrupt-backup`, raw).catch(() => undefined);
    return undefined;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AsyncStorageRepository implements FaviourRepository {
  // In-memory mirror hydrated by load(); every mutation updates it, then persists.
  private db: DbSnapshot | null = null;
  // Single-flights loading: concurrent load()/mutation calls must never each
  // hydrate their own mirror — a stale one would clobber committed writes on
  // its next whole-collection persist.
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<DbSnapshot> {
    if (!this.db) {
      if (!this.loadPromise) {
        this.loadPromise = this.hydrate().catch((e) => {
          this.loadPromise = null; // allow a retry after a failed load
          throw e;
        });
      }
      await this.loadPromise;
    }
    return this.snapshot();
  }

  private async hydrate(): Promise<void> {
    const entries = await AsyncStorage.multiGet([
      KEYS.meta,
      KEYS.profiles,
      KEYS.items,
      KEYS.tags,
    ]);
    const byKey: Record<string, string | null> = {};
    for (const [key, value] of entries) {
      byKey[key] = value;
    }
    const meta = parseJson<{ schemaVersion: number }>(byKey[KEYS.meta], KEYS.meta);
    const fromVersion = meta?.schemaVersion ?? 0;
    this.db = runMigrations(
      {
        profiles: parseJson<Profile[]>(byKey[KEYS.profiles], KEYS.profiles),
        items: parseJson<Item[]>(byKey[KEYS.items], KEYS.items),
        reasonTags: parseJson<string[]>(byKey[KEYS.tags], KEYS.tags),
      },
      fromVersion,
    );
    if (fromVersion !== CURRENT_SCHEMA_VERSION) {
      await this.persistAll();
    }
  }

  async createProfile(input: NewProfileInput): Promise<Profile> {
    const db = await this.requireDb();
    const profile: Profile = {
      id: newId(),
      name: input.name.trim(),
      createdAt: nowIso(),
    };
    db.profiles = [...db.profiles, profile];
    await AsyncStorage.setItem(KEYS.profiles, JSON.stringify(db.profiles));
    return { ...profile };
  }

  async deleteProfile(id: string): Promise<void> {
    const db = await this.requireDb();
    const doomedItems = db.items.filter((i) => i.profileId === id).map((i) => i.id);
    db.profiles = db.profiles.filter((p) => p.id !== id);
    db.items = db.items.filter((i) => i.profileId !== id);
    await AsyncStorage.multiSet([
      [KEYS.profiles, JSON.stringify(db.profiles)],
      [KEYS.items, JSON.stringify(db.items)],
    ]);
    const deletedAt = nowIso();
    await this.appendTombstones([
      { kind: 'profile', id, deletedAt },
      ...doomedItems.map((itemId): Tombstone => ({ kind: 'item', id: itemId, deletedAt })),
    ]);
  }

  async createItem(input: NewItemInput): Promise<Item> {
    const db = await this.requireDb();
    const now = nowIso();
    const item: Item = {
      id: newId(),
      profileId: input.profileId,
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand.trim(),
      preference: input.preference,
      reasonTags: dedupeTags(input.reasonTags ?? []),
      notes: input.notes ?? '',
      barcode: input.barcode ?? null,
      photoFileName: input.photoFileName ?? null,
      rankInCategory: null,
      createdAt: now,
      updatedAt: now,
    };
    db.items = [...db.items, item];
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
    return { ...item };
  }

  async updateItem(id: string, patch: Partial<NewItemInput>): Promise<Item> {
    const db = await this.requireDb();
    const existing = db.items.find((i) => i.id === id);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }
    const changes: Partial<Item> = {};
    if (patch.profileId !== undefined) changes.profileId = patch.profileId;
    if (patch.name !== undefined) changes.name = patch.name.trim();
    if (patch.category !== undefined) changes.category = patch.category.trim();
    if (patch.brand !== undefined) changes.brand = patch.brand.trim();
    if (patch.preference !== undefined) changes.preference = patch.preference;
    if (patch.reasonTags !== undefined) changes.reasonTags = dedupeTags(patch.reasonTags);
    if (patch.notes !== undefined) changes.notes = patch.notes;
    if (patch.barcode !== undefined) changes.barcode = patch.barcode;
    if (patch.photoFileName !== undefined) changes.photoFileName = patch.photoFileName;
    // Rank hygiene: a rank only means something within one profile+category
    // ladder, so leaving either invalidates it. Case-only category edits
    // ("wings" → "Wings") keep the rank.
    const categoryChanged =
      changes.category !== undefined &&
      changes.category.toLowerCase() !== existing.category.toLowerCase();
    const profileChanged =
      changes.profileId !== undefined && changes.profileId !== existing.profileId;
    if (categoryChanged || profileChanged) {
      changes.rankInCategory = null;
    }
    const updated: Item = { ...existing, ...changes, updatedAt: nowIso() };
    db.items = db.items.map((i) => (i.id === id ? updated : i));
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
    return { ...updated };
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.requireDb();
    db.items = db.items.filter((i) => i.id !== id);
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
    await this.appendTombstones([{ kind: 'item', id, deletedAt: nowIso() }]);
  }

  async addReasonTag(tag: string): Promise<string[]> {
    const db = await this.requireDb();
    db.reasonTags = dedupeTags([...db.reasonTags, tag]);
    await AsyncStorage.setItem(KEYS.tags, JSON.stringify(db.reasonTags));
    return [...db.reasonTags];
  }

  async setCategoryRanks(
    profileId: string,
    category: string,
    orderedItemIds: string[],
  ): Promise<Item[]> {
    const db = await this.requireDb();
    const categoryKey = category.trim().toLowerCase();
    const rankById = new Map(orderedItemIds.map((id, index) => [id, index + 1]));
    db.items = db.items.map((item) => {
      const inLadder =
        item.profileId === profileId &&
        item.category.trim().toLowerCase() === categoryKey;
      if (!inLadder) {
        return item;
      }
      const rank = rankById.get(item.id) ?? null;
      return item.rankInCategory === rank ? item : { ...item, rankInCategory: rank };
    });
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
    return [...db.items];
  }

  async exportSnapshot(): Promise<DbSnapshot> {
    return this.load();
  }

  async importSnapshot(
    incoming: DbSnapshot,
    mode: ImportMode,
    options?: ImportOptions,
  ): Promise<DbSnapshot> {
    const db = await this.requireDb();
    try {
      await AsyncStorage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Failed to write pre-import backup', e);
    }
    const previous = db;
    this.db =
      mode === 'replace'
        ? { ...incoming, schemaVersion: CURRENT_SCHEMA_VERSION }
        : mergeSnapshots(db, incoming);
    await this.persistAll();
    if (mode === 'replace' && (options?.journalRemovals ?? true)) {
      const deletedAt = nowIso();
      const keptProfiles = new Set(this.db.profiles.map((p) => p.id));
      const keptItems = new Set(this.db.items.map((i) => i.id));
      const removed: Tombstone[] = [
        ...previous.profiles
          .filter((p) => !keptProfiles.has(p.id))
          .map((p): Tombstone => ({ kind: 'profile', id: p.id, deletedAt })),
        ...previous.items
          .filter((i) => !keptItems.has(i.id))
          .map((i): Tombstone => ({ kind: 'item', id: i.id, deletedAt })),
      ];
      if (removed.length > 0) {
        await this.appendTombstones(removed);
      }
    }
    return this.snapshot();
  }

  async getTombstones(): Promise<Tombstone[]> {
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    const parsed = parseJson<Tombstone[]>(raw, TOMBSTONES_KEY);
    return Array.isArray(parsed) ? parsed : [];
  }

  async pruneTombstones(ids: string[]): Promise<void> {
    const drop = new Set(ids);
    const remaining = (await this.getTombstones()).filter((t) => !drop.has(t.id));
    await AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(remaining));
  }

  private async appendTombstones(entries: Tombstone[]): Promise<void> {
    try {
      const journal = [...(await this.getTombstones()), ...entries];
      await AsyncStorage.setItem(
        TOMBSTONES_KEY,
        JSON.stringify(journal.slice(-TOMBSTONE_CAP)),
      );
    } catch (e) {
      console.warn('Failed to append tombstones', e);
    }
  }

  private async requireDb(): Promise<DbSnapshot> {
    if (!this.db) {
      await this.load();
    }
    if (!this.db) {
      throw new Error('Storage failed to load');
    }
    return this.db;
  }

  private async persistAll(): Promise<void> {
    if (!this.db) {
      return;
    }
    await AsyncStorage.multiSet([
      [KEYS.meta, JSON.stringify({ schemaVersion: this.db.schemaVersion })],
      [KEYS.profiles, JSON.stringify(this.db.profiles)],
      [KEYS.items, JSON.stringify(this.db.items)],
      [KEYS.tags, JSON.stringify(this.db.reasonTags)],
    ]);
  }

  private snapshot(): DbSnapshot {
    const db = this.db;
    if (!db) {
      throw new Error('Storage not loaded');
    }
    return {
      schemaVersion: db.schemaVersion,
      profiles: [...db.profiles],
      items: [...db.items],
      reasonTags: [...db.reasonTags],
    };
  }
}
