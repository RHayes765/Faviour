import { categoryRanking, rankInfo } from '../src/utils/ranking';
import type { Item } from '../src/types';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'i1',
    profileId: 'p1',
    name: 'Thing',
    category: 'Wings',
    brand: 'Brand',
    preference: 'like',
    reasonTags: [],
    notes: '',
    barcode: null,
    photoFileName: null,
    rankInCategory: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const items: Item[] = [
  makeItem({ id: 'a', name: 'Alpha Wings', rankInCategory: 2 }),
  makeItem({ id: 'b', name: 'Best Wings', rankInCategory: 1 }),
  makeItem({ id: 'c', name: 'New Wings', rankInCategory: null, updatedAt: '2026-06-01T00:00:00.000Z' }),
  makeItem({ id: 'd', name: 'Older New Wings', rankInCategory: null, updatedAt: '2026-05-01T00:00:00.000Z' }),
  makeItem({ id: 'other-profile', profileId: 'p2', rankInCategory: 1 }),
  makeItem({ id: 'other-category', category: 'Dips', rankInCategory: 1 }),
];

describe('categoryRanking', () => {
  it('splits ranked (by rank) and unranked (by recency), scoped to profile+category', () => {
    const { ranked, unranked } = categoryRanking(items, 'p1', 'Wings');
    expect(ranked.map((i) => i.id)).toEqual(['b', 'a']);
    expect(unranked.map((i) => i.id)).toEqual(['c', 'd']);
  });

  it('matches category case-insensitively', () => {
    const { ranked } = categoryRanking(items, 'p1', '  wings ');
    expect(ranked.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('rankInfo', () => {
  it('reports dense positions so deletion gaps never show', () => {
    // b holds rank 1, a holds rank 5 (former #2..#4 deleted) — a shows as #2 of 2.
    const gappy = [
      makeItem({ id: 'b', rankInCategory: 1 }),
      makeItem({ id: 'a', rankInCategory: 5 }),
    ];
    expect(rankInfo(gappy, gappy[1])).toEqual({ position: 2, total: 2 });
    expect(rankInfo(gappy, gappy[0])).toEqual({ position: 1, total: 2 });
  });

  it('returns null for unranked items', () => {
    expect(rankInfo(items, items.find((i) => i.id === 'c')!)).toBeNull();
  });
});
