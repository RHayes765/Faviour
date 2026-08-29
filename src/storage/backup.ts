import type { DbSnapshot, Item, Preference, Profile } from '../types';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations';

export interface BackupSummary {
  profileCount: number;
  itemCount: number;
  exportedAt: string | null;
}

export type BackupValidation =
  | { ok: true; snapshot: DbSnapshot; summary: BackupSummary }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    createdAt: asString(value.createdAt, new Date(0).toISOString()),
  };
}

function parseItem(value: unknown): Item | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.profileId !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return null;
  }
  const preference: Preference = value.preference === 'dislike' ? 'dislike' : 'like';
  const epoch = new Date(0).toISOString();
  return {
    id: value.id,
    profileId: value.profileId,
    name: value.name,
    category: asString(value.category),
    brand: asString(value.brand),
    preference,
    reasonTags: Array.isArray(value.reasonTags)
      ? value.reasonTags.filter((t): t is string => typeof t === 'string')
      : [],
    notes: asString(value.notes),
    barcode: typeof value.barcode === 'string' ? value.barcode : null,
    photoFileName: typeof value.photoFileName === 'string' ? value.photoFileName : null,
    rankInCategory: typeof value.rankInCategory === 'number' ? value.rankInCategory : null,
    createdAt: asString(value.createdAt, epoch),
    updatedAt: asString(value.updatedAt, epoch),
  };
}

/**
 * Structurally validates a parsed backup file and migrates it to the current
 * schema, so exports from any older Faviour version import forever. Unknown
 * keys are ignored; a backup from a NEWER app version is rejected.
 */
export function validateBackup(parsed: unknown): BackupValidation {
  if (!isRecord(parsed)) {
    return { ok: false, reason: "This file isn't a Faviour backup." };
  }
  const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        'This backup was made by a newer version of Faviour. Update the app, then import again.',
    };
  }
  if (!Array.isArray(parsed.profiles) || !Array.isArray(parsed.items)) {
    return { ok: false, reason: "This file isn't a Faviour backup." };
  }

  const profiles: Profile[] = [];
  for (const raw of parsed.profiles) {
    const profile = parseProfile(raw);
    if (!profile) {
      return { ok: false, reason: 'The backup file is damaged (bad profile entry).' };
    }
    profiles.push(profile);
  }

  const items: Item[] = [];
  for (const raw of parsed.items) {
    const item = parseItem(raw);
    if (!item) {
      return { ok: false, reason: 'The backup file is damaged (bad item entry).' };
    }
    items.push(item);
  }

  const reasonTags = Array.isArray(parsed.reasonTags)
    ? parsed.reasonTags.filter((t): t is string => typeof t === 'string')
    : [];

  const snapshot = runMigrations({ profiles, items, reasonTags }, version);
  return {
    ok: true,
    snapshot,
    summary: {
      profileCount: snapshot.profiles.length,
      itemCount: snapshot.items.length,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    },
  };
}
