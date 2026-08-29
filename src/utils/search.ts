import type { Item, Preference } from '../types';

export interface ItemFilterCriteria {
  /** Free-text search across name, brand, category, and notes. */
  query?: string;
  profileId?: string | 'all';
  category?: string | 'all';
  brand?: string | 'all';
  preference?: Preference | 'all';
}

export function filterItems(items: Item[], criteria: ItemFilterCriteria): Item[] {
  const query = (criteria.query ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (
      criteria.profileId &&
      criteria.profileId !== 'all' &&
      item.profileId !== criteria.profileId
    ) {
      return false;
    }
    if (
      criteria.category &&
      criteria.category !== 'all' &&
      item.category !== criteria.category
    ) {
      return false;
    }
    if (criteria.brand && criteria.brand !== 'all' && item.brand !== criteria.brand) {
      return false;
    }
    if (
      criteria.preference &&
      criteria.preference !== 'all' &&
      item.preference !== criteria.preference
    ) {
      return false;
    }
    if (query) {
      const haystack = [item.name, item.brand, item.category, item.notes ?? '']
        .join('\n')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

/** Most recently updated first — "what did I just try" floats to the top. */
export function sortByRecency(items: Item[]): Item[] {
  return [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Distinct non-empty values, deduped case-insensitively, sorted alphabetically. */
export function distinctValues(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.set(key, trimmed);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
