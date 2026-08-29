import type { DbSnapshot, Item, Profile } from '../types';
import { dedupeTags } from '../utils/tags';
import { CURRENT_SCHEMA_VERSION } from './migrations';

/**
 * Pure merge of an incoming (already-validated, already-migrated) snapshot
 * into the local one — the cross-phone import path.
 *
 * - Profiles match by id, else by trimmed case-insensitive name (two phones
 *   that each created "Mom" independently get one merged profile); otherwise
 *   they're appended.
 * - Items are remapped through matched profiles and unioned by id; on an id
 *   collision the newer updatedAt wins, ties keep local.
 * - Reason tags union case-insensitively.
 *
 * Same-product items with different ids stay as duplicates (documented v1
 * limitation), and duplicate ranks after a merge are tolerated — rank display
 * is positional and the next re-drag compacts them.
 */
export function mergeSnapshots(local: DbSnapshot, incoming: DbSnapshot): DbSnapshot {
  const profiles: Profile[] = [...local.profiles];
  const profileIdRemap = new Map<string, string>();

  for (const inc of incoming.profiles) {
    if (profiles.some((p) => p.id === inc.id)) {
      continue; // same profile on both sides — keep local
    }
    const nameKey = inc.name.trim().toLowerCase();
    const byName = profiles.find((p) => p.name.trim().toLowerCase() === nameKey);
    if (byName) {
      profileIdRemap.set(inc.id, byName.id);
      continue;
    }
    profiles.push(inc);
  }

  const itemsById = new Map<string, Item>(local.items.map((i) => [i.id, i]));
  for (const raw of incoming.items) {
    const remappedProfileId = profileIdRemap.get(raw.profileId);
    const inc: Item = remappedProfileId ? { ...raw, profileId: remappedProfileId } : raw;
    const existing = itemsById.get(inc.id);
    if (!existing || inc.updatedAt > existing.updatedAt) {
      itemsById.set(inc.id, inc);
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles,
    items: [...itemsById.values()],
    reasonTags: dedupeTags([...local.reasonTags, ...incoming.reasonTags]),
  };
}
