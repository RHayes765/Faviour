import { mergeSnapshots } from '../storage/merge';
import { CURRENT_SCHEMA_VERSION } from '../storage/migrations';
import type { Tombstone } from '../storage/repository';
import type { DbSnapshot, Item } from '../types';
import { dedupeTags } from '../utils/tags';
import { rowToItem, rowToProfile, type ItemRow, type ProfileRow } from './rows';

// The pure heart of sync. Ordering is what prevents deleted rows from
// resurrecting:
//   1. remote tombstones beat OLDER local rows (a local edit newer than the
//      tombstone legitimately resurrects the row),
//   2. the local deletion journal filters remote rows older than the delete,
//   3. the survivors merge via the same LWW machinery as backup import.

export interface RemoteState {
  profiles: ProfileRow[];
  items: ItemRow[];
  tags: string[];
}

export function reconcile(
  local: DbSnapshot,
  journal: Tombstone[],
  remote: RemoteState,
): DbSnapshot {
  // 1. Remote tombstones vs local rows.
  const itemTombstoneAt = new Map<string, string>();
  const profileTombstoneAt = new Map<string, string>();
  for (const row of remote.items) {
    if (row.deleted_at) {
      itemTombstoneAt.set(row.id, row.deleted_at);
    }
  }
  for (const row of remote.profiles) {
    if (row.deleted_at) {
      profileTombstoneAt.set(row.id, row.deleted_at);
    }
  }

  const localProfiles = local.profiles.filter((p) => {
    const tombstonedAt = profileTombstoneAt.get(p.id);
    return !tombstonedAt || tombstonedAt < p.createdAt;
  });
  const keptProfileIds = new Set(localProfiles.map((p) => p.id));
  const localItems = local.items.filter((i) => {
    if (!keptProfileIds.has(i.profileId)) {
      return false; // cascade of a remote profile tombstone
    }
    const tombstonedAt = itemTombstoneAt.get(i.id);
    return !tombstonedAt || tombstonedAt < i.updatedAt;
  });

  // 2. Local journal vs remote live rows.
  const journalAt = new Map<string, string>();
  for (const t of journal) {
    const existing = journalAt.get(`${t.kind}:${t.id}`);
    if (!existing || t.deletedAt > existing) {
      journalAt.set(`${t.kind}:${t.id}`, t.deletedAt);
    }
  }
  const remoteLiveProfiles = remote.profiles.filter((row) => {
    if (row.deleted_at) {
      return false;
    }
    const deletedAt = journalAt.get(`profile:${row.id}`);
    return !deletedAt || deletedAt < row.updated_at;
  });
  const remoteLiveProfileIds = new Set(remoteLiveProfiles.map((r) => r.id));
  const remoteLiveItems = remote.items.filter((row) => {
    if (row.deleted_at || !remoteLiveProfileIds.has(row.profile_id)) {
      return false;
    }
    const deletedAt = journalAt.get(`item:${row.id}`);
    return !deletedAt || deletedAt < row.updated_at;
  });

  // 3. Merge survivors (id union, profile name-matching, newer-updatedAt wins).
  return mergeSnapshots(
    {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: localProfiles,
      items: localItems,
      reasonTags: local.reasonTags,
    },
    {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: remoteLiveProfiles.map(rowToProfile),
      items: remoteLiveItems.map(rowToItem),
      reasonTags: dedupeTags(remote.tags),
    },
  );
}

/**
 * A remote-won row can carry a photo filename from another device; if that
 * file doesn't exist here but this device's own photo for the item does,
 * keep the local filename — never orphan a local photo over metadata.
 */
export function reconcilePhotos(
  localItems: Item[],
  mergedItems: Item[],
  photoExists: (fileName: string) => boolean,
): Item[] {
  const localByld = new Map(localItems.map((i) => [i.id, i]));
  return mergedItems.map((item) => {
    if (!item.photoFileName || photoExists(item.photoFileName)) {
      return item;
    }
    const local = localByld.get(item.id);
    if (local?.photoFileName && photoExists(local.photoFileName)) {
      return { ...item, photoFileName: local.photoFileName };
    }
    return { ...item, photoFileName: null };
  });
}
