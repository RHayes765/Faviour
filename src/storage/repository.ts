import type {
  DbSnapshot,
  Item,
  NewItemInput,
  NewProfileInput,
  Profile,
} from '../types';

export type ImportMode = 'replace' | 'merge';

/**
 * The persistence seam. UI code (via DataContext) only ever talks to this
 * interface, so AsyncStorage can later be swapped for SQLite or a backend
 * without touching screens.
 */
export interface FaviourRepository {
  /** Loads (and migrates, if needed) the full snapshot. */
  load(): Promise<DbSnapshot>;
  createProfile(input: NewProfileInput): Promise<Profile>;
  /** Deletes the profile and cascades deletion of its items. */
  deleteProfile(id: string): Promise<void>;
  createItem(input: NewItemInput): Promise<Item>;
  updateItem(id: string, patch: Partial<NewItemInput>): Promise<Item>;
  deleteItem(id: string): Promise<void>;
  /** Adds a reason tag (deduped case-insensitively); returns the full list. */
  addReasonTag(tag: string): Promise<string[]>;
  /**
   * Reorders one profile+category ladder (category matched
   * case-insensitively, consistent with filterItems). Listed items get rank
   * 1..n; other items in that profile+category become unranked; nothing else
   * is touched, and updatedAt is NOT bumped (ranking isn't a "tried it"
   * event). Single persist; returns the full updated items array.
   */
  setCategoryRanks(
    profileId: string,
    category: string,
    orderedItemIds: string[],
  ): Promise<Item[]>;
  /** Defensive copy of the current snapshot, for backup export. */
  exportSnapshot(): Promise<DbSnapshot>;
  /**
   * Replaces or merges with an already-validated, already-migrated snapshot.
   * Writes a best-effort copy of the pre-import database to a backup key
   * first, persists once, and returns the new full snapshot.
   */
  importSnapshot(incoming: DbSnapshot, mode: ImportMode): Promise<DbSnapshot>;
}
