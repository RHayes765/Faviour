import type { Item, Preference } from '../types';

// All grouping is case-insensitive keyed on toLowerCase() with the first-seen
// spelling shown (same convention as distinctValues); sorts are deterministic:
// count desc, then alphabetical.

export interface VerdictTotals {
  total: number;
  likes: number;
  dislikes: number;
  /** likes / total, or null when there are no items. */
  likeRatio: number | null;
}

export function verdictTotals(items: Item[]): VerdictTotals {
  const likes = items.filter((i) => i.preference === 'like').length;
  const total = items.length;
  return {
    total,
    likes,
    dislikes: total - likes,
    likeRatio: total === 0 ? null : likes / total,
  };
}

interface Counter {
  label: string;
  count: number;
}

function countBy(values: string[]): Counter[] {
  const byKey = new Map<string, Counter>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    const entry = byKey.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      byKey.set(key, { label: trimmed, count: 1 });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export function topReasonTags(
  items: Item[],
  preference: Preference,
  limit = 5,
): { tag: string; count: number }[] {
  return countBy(
    items.filter((i) => i.preference === preference).flatMap((i) => i.reasonTags),
  )
    .slice(0, limit)
    .map(({ label, count }) => ({ tag: label, count }));
}

export interface BrandLikeRatio {
  brand: string;
  total: number;
  likes: number;
  ratio: number;
}

export function brandLikeRatios(items: Item[], minItems = 2): BrandLikeRatio[] {
  const byKey = new Map<string, BrandLikeRatio>();
  for (const item of items) {
    const brand = item.brand.trim();
    if (!brand) {
      continue;
    }
    const key = brand.toLowerCase();
    const entry = byKey.get(key) ?? { brand, total: 0, likes: 0, ratio: 0 };
    entry.total += 1;
    if (item.preference === 'like') {
      entry.likes += 1;
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()]
    .filter((b) => b.total >= minItems)
    .map((b) => ({ ...b, ratio: b.likes / b.total }))
    .sort(
      (a, b) =>
        b.ratio - a.ratio || b.total - a.total || a.brand.localeCompare(b.brand),
    );
}

export function topCategories(
  items: Item[],
  limit = 5,
): { category: string; count: number }[] {
  return countBy(items.map((i) => i.category))
    .slice(0, limit)
    .map(({ label, count }) => ({ category: label, count }));
}
