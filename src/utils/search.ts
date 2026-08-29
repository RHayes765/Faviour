import type { Item, Preference } from '../types';

export interface ItemFilterCriteria {
  /** Free-text search across name, brand, category, and notes. */
  query?: string;
  profileId?: string;
  category?: string;
  brand?: string;
  preference?: Preference | string;
}

/** Sentinel for "no filter". Deliberately not a plausible user value — a brand
 * literally named "all" must remain filterable. */
export const ALL_FILTER = '__all__';

function isActive(value: string | undefined): value is string {
  return Boolean(value) && value !== ALL_FILTER;
}

export function filterItems(items: Item[], criteria: ItemFilterCriteria): Item[] {
  const query = (criteria.query ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (isActive(criteria.profileId) && item.profileId !== criteria.profileId) {
      return false;
    }
    // Category/brand match case-insensitively — the filter dropdowns dedupe
    // options case-insensitively, so matching must agree with them.
    if (
      isActive(criteria.category) &&
      item.category.toLowerCase() !== criteria.category.toLowerCase()
    ) {
      return false;
    }
    if (
      isActive(criteria.brand) &&
      item.brand.toLowerCase() !== criteria.brand.toLowerCase()
    ) {
      return false;
    }
    if (isActive(criteria.preference) && item.preference !== criteria.preference) {
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
