import type { Item, Preference, Profile } from '../types';

// Pure mappers between the app's camelCase domain types and the Postgres
// snake_case rows. Tombstone state (deleted_at) travels alongside.

export interface ProfileRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ItemRow {
  id: string;
  owner_id: string;
  profile_id: string;
  name: string;
  category: string;
  brand: string;
  preference: Preference;
  reason_tags: string[];
  notes: string;
  barcode: string | null;
  photo_file_name: string | null;
  rank_in_category: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function profileToRow(profile: Profile, ownerId: string): ProfileRow {
  return {
    id: profile.id,
    owner_id: ownerId,
    name: profile.name,
    created_at: profile.createdAt,
    // Profiles have no updatedAt locally; createdAt stands in so LWW still
    // has a stable comparison point.
    updated_at: profile.createdAt,
    deleted_at: null,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function itemToRow(item: Item, ownerId: string): ItemRow {
  return {
    id: item.id,
    owner_id: ownerId,
    profile_id: item.profileId,
    name: item.name,
    category: item.category,
    brand: item.brand,
    preference: item.preference,
    reason_tags: item.reasonTags,
    notes: item.notes,
    barcode: item.barcode,
    photo_file_name: item.photoFileName,
    rank_in_category: item.rankInCategory,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: null,
  };
}

export function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    preference: row.preference === 'dislike' ? 'dislike' : 'like',
    reasonTags: row.reason_tags ?? [],
    notes: row.notes ?? '',
    barcode: row.barcode,
    photoFileName: row.photo_file_name,
    rankInCategory: row.rank_in_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
