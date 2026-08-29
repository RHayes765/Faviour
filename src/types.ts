export type Preference = 'like' | 'dislike';

export interface Profile {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
}

export interface Item {
  id: string;
  profileId: string;
  name: string;
  category: string;
  brand: string;
  preference: Preference;
  reasonTags: string[];
  notes: string;
  barcode: string | null; // normalized digits (see utils/barcode.ts)
  photoFileName: string | null; // filename only; resolved against the photo dir at render
  /** Position in this profile's ladder for this category; null = unranked.
   * Only written via setCategoryRanks — may have gaps after deletions, so
   * display uses dense positions (utils/ranking.ts). */
  rankInCategory: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface DbSnapshot {
  schemaVersion: number;
  profiles: Profile[];
  items: Item[];
  reasonTags: string[];
}

export interface NewProfileInput {
  name: string;
}

export interface NewItemInput {
  profileId: string;
  name: string;
  category: string;
  brand: string;
  preference: Preference;
  reasonTags?: string[];
  notes?: string;
  barcode?: string | null;
  photoFileName?: string | null;
}
