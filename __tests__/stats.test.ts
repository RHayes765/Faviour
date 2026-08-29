import {
  brandLikeRatios,
  topCategories,
  topReasonTags,
  verdictTotals,
} from '../src/utils/stats';
import type { Item } from '../src/types';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2),
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

describe('verdictTotals', () => {
  it('counts likes/dislikes and computes the ratio', () => {
    const items = [
      makeItem({ preference: 'like' }),
      makeItem({ preference: 'like' }),
      makeItem({ preference: 'dislike' }),
      makeItem({ preference: 'like' }),
    ];
    expect(verdictTotals(items)).toEqual({
      total: 4,
      likes: 3,
      dislikes: 1,
      likeRatio: 0.75,
    });
  });

  it('returns null ratio for empty input', () => {
    expect(verdictTotals([]).likeRatio).toBeNull();
  });
});

describe('topReasonTags', () => {
  it('counts tags case-insensitively per verdict, sorted by count then alpha', () => {
    const items = [
      makeItem({ preference: 'dislike', reasonTags: ['Too salty', 'Bland'] }),
      makeItem({ preference: 'dislike', reasonTags: ['too salty'] }),
      makeItem({ preference: 'like', reasonTags: ['Great value'] }),
    ];
    expect(topReasonTags(items, 'dislike')).toEqual([
      { tag: 'Too salty', count: 2 },
      { tag: 'Bland', count: 1 },
    ]);
    expect(topReasonTags(items, 'like')).toEqual([{ tag: 'Great value', count: 1 }]);
  });

  it('respects the limit', () => {
    const items = [
      makeItem({ reasonTags: ['a', 'b', 'c'] }),
    ];
    expect(topReasonTags(items, 'like', 2)).toHaveLength(2);
  });
});

describe('brandLikeRatios', () => {
  it('groups case-insensitively, applies min threshold, sorts by ratio then volume', () => {
    const items = [
      makeItem({ brand: 'BigFizz', preference: 'like' }),
      makeItem({ brand: 'bigfizz', preference: 'like' }),
      makeItem({ brand: 'Frank Foods', preference: 'like' }),
      makeItem({ brand: 'Frank Foods', preference: 'dislike' }),
      makeItem({ brand: 'OnlyOnce', preference: 'like' }), // below threshold
    ];
    const result = brandLikeRatios(items);
    expect(result.map((r) => r.brand)).toEqual(['BigFizz', 'Frank Foods']);
    expect(result[0]).toMatchObject({ total: 2, likes: 2, ratio: 1 });
    expect(result[1]).toMatchObject({ total: 2, likes: 1, ratio: 0.5 });
  });
});

describe('topCategories', () => {
  it('counts case-insensitively with first-seen spelling', () => {
    const items = [
      makeItem({ category: 'Wings' }),
      makeItem({ category: 'wings' }),
      makeItem({ category: 'Dips' }),
    ];
    expect(topCategories(items)).toEqual([
      { category: 'Wings', count: 2 },
      { category: 'Dips', count: 1 },
    ]);
  });
});
