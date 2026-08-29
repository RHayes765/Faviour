import type { Item } from '../src/types';
import { distinctValues, filterItems, sortByRecency } from '../src/utils/search';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'i1',
    profileId: 'p1',
    name: 'Spicy Chicken Tenders',
    category: 'Chicken Tenders',
    brand: "McDonald's",
    preference: 'like',
    reasonTags: [],
    notes: '',
    barcode: null,
    photoFileName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const items: Item[] = [
  makeItem({ id: 'a', name: 'Spicy Chicken Tenders', brand: "McDonald's", notes: 'too salty' }),
  makeItem({
    id: 'b',
    name: 'Buffalo Wings',
    category: 'Wings',
    brand: 'Frank Foods',
    preference: 'dislike',
    profileId: 'p2',
  }),
  makeItem({ id: 'c', name: 'Ranch Dip', category: 'Dips', brand: 'Hidden Valley' }),
];

describe('filterItems', () => {
  it('returns everything with no criteria', () => {
    expect(filterItems(items, {})).toHaveLength(3);
  });

  it('matches query against name, brand, category, and notes', () => {
    expect(filterItems(items, { query: 'wings' }).map((i) => i.id)).toEqual(['b']);
    expect(filterItems(items, { query: "mcdonald's" }).map((i) => i.id)).toEqual(['a']);
    expect(filterItems(items, { query: 'dips' }).map((i) => i.id)).toEqual(['c']);
    expect(filterItems(items, { query: 'salty' }).map((i) => i.id)).toEqual(['a']);
  });

  it('does not crash on items with missing notes (legacy data)', () => {
    const legacy = [makeItem({ id: 'x', notes: undefined as unknown as string })];
    expect(filterItems(legacy, { query: 'anything' })).toEqual([]);
    expect(filterItems(legacy, { query: 'spicy' })).toHaveLength(1);
  });

  it('combines filters (AND semantics)', () => {
    expect(
      filterItems(items, { profileId: 'p1', preference: 'like', query: 'chicken' }),
    ).toHaveLength(1);
    expect(filterItems(items, { profileId: 'p2', preference: 'like' })).toHaveLength(0);
  });

  it("treats 'all' as no filter", () => {
    expect(
      filterItems(items, { profileId: 'all', category: 'all', brand: 'all', preference: 'all' }),
    ).toHaveLength(3);
  });
});

describe('sortByRecency', () => {
  it('sorts most recently updated first without mutating input', () => {
    const list = [
      makeItem({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: 'new', updatedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    const sorted = sortByRecency(list);
    expect(sorted.map((i) => i.id)).toEqual(['new', 'old']);
    expect(list.map((i) => i.id)).toEqual(['old', 'new']);
  });
});

describe('distinctValues', () => {
  it('dedupes case-insensitively, trims, drops empties, and sorts', () => {
    expect(distinctValues(['Wings', 'wings', ' Dips ', '', 'Chips'])).toEqual([
      'Chips',
      'Dips',
      'Wings',
    ]);
  });
});
