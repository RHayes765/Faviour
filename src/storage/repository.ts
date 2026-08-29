import type {
  DbSnapshot,
  Item,
  NewItemInput,
  NewProfileInput,
  Profile,
} from '../types';

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
}
