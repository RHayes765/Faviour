import type { Item } from '../types';

export interface CategoryRanking {
  /** Ranked items in ladder order (rank ascending, stable tie-break by name then id). */
  ranked: Item[];
  /** Items in the same profile+category with no rank yet, most recent first. */
  unranked: Item[];
}

function inLadder(item: Item, profileId: string, category: string): boolean {
  return (
    item.profileId === profileId &&
    item.category.trim().toLowerCase() === category.trim().toLowerCase()
  );
}

export function categoryRanking(
  items: Item[],
  profileId: string,
  category: string,
): CategoryRanking {
  const ladder = items.filter((i) => inLadder(i, profileId, category));
  const ranked = ladder
    .filter((i) => i.rankInCategory !== null)
    .sort(
      (a, b) =>
        a.rankInCategory! - b.rankInCategory! ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  const unranked = ladder
    .filter((i) => i.rankInCategory === null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { ranked, unranked };
}

/**
 * Dense position of an item within its ladder — after the #1 is deleted the
 * old #2 reads as "#1 of n", never "#2 of n".
 */
export function rankInfo(
  items: Item[],
  item: Item,
): { position: number; total: number } | null {
  if (item.rankInCategory === null) {
    return null;
  }
  const { ranked } = categoryRanking(items, item.profileId, item.category);
  const index = ranked.findIndex((i) => i.id === item.id);
  if (index === -1) {
    return null;
  }
  return { position: index + 1, total: ranked.length };
}
