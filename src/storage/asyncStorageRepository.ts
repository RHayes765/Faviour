import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  DbSnapshot,
  Item,
  NewItemInput,
  NewProfileInput,
  Profile,
} from '../types';
import { newId } from './ids';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations';
import type { FaviourRepository } from './repository';

const KEYS = {
  meta: '@faviour:meta',
  profiles: '@faviour:profiles',
  items: '@faviour:items',
  tags: '@faviour:tags',
} as const;

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (raw == null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Dedupes case-insensitively, keeping the first spelling seen. */
function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

export class AsyncStorageRepository implements FaviourRepository {
  // In-memory mirror hydrated by load(); every mutation updates it, then persists.
  private db: DbSnapshot | null = null;

  async load(): Promise<DbSnapshot> {
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
    const meta = parseJson<{ schemaVersion: number }>(byKey[KEYS.meta]);
    const fromVersion = meta?.schemaVersion ?? 0;
    this.db = runMigrations(
      {
        profiles: parseJson<Profile[]>(byKey[KEYS.profiles]),
        items: parseJson<Item[]>(byKey[KEYS.items]),
        reasonTags: parseJson<string[]>(byKey[KEYS.tags]),
      },
      fromVersion,
    );
    if (fromVersion !== CURRENT_SCHEMA_VERSION) {
      await this.persistAll();
    }
    return this.snapshot();
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
    db.profiles = db.profiles.filter((p) => p.id !== id);
    db.items = db.items.filter((i) => i.profileId !== id);
    await AsyncStorage.multiSet([
      [KEYS.profiles, JSON.stringify(db.profiles)],
      [KEYS.items, JSON.stringify(db.items)],
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
    const updated: Item = { ...existing, ...changes, updatedAt: nowIso() };
    db.items = db.items.map((i) => (i.id === id ? updated : i));
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
    return { ...updated };
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.requireDb();
    db.items = db.items.filter((i) => i.id !== id);
    await AsyncStorage.setItem(KEYS.items, JSON.stringify(db.items));
  }

  async addReasonTag(tag: string): Promise<string[]> {
    const db = await this.requireDb();
    db.reasonTags = dedupeTags([...db.reasonTags, tag]);
    await AsyncStorage.setItem(KEYS.tags, JSON.stringify(db.reasonTags));
    return [...db.reasonTags];
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
