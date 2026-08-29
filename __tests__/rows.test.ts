import {
  itemToRow,
  profileToRow,
  rowToItem,
  rowToProfile,
} from '../src/sync/rows';
import type { Item, Profile } from '../src/types';

const OWNER = 'owner-uuid';

const profile: Profile = {
  id: 'p1',
  name: 'Ryley',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const item: Item = {
  id: 'i1',
  profileId: 'p1',
  name: 'Spicy Wings',
  category: 'Wings',
  brand: 'FrankCo',
  preference: 'dislike',
  reasonTags: ['Too spicy'],
  notes: 'whew',
  barcode: '0012345678905',
  photoFileName: 'abc.jpg',
  rankInCategory: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

describe('row mappers', () => {
  it('round-trips a profile', () => {
    const row = profileToRow(profile, OWNER);
    expect(row.owner_id).toBe(OWNER);
    expect(rowToProfile(row)).toEqual(profile);
  });

  it('round-trips an item, preserving nullables and rank', () => {
    const row = itemToRow(item, OWNER);
    expect(row.owner_id).toBe(OWNER);
    expect(row.deleted_at).toBeNull();
    expect(rowToItem(row)).toEqual(item);
  });

  it('round-trips null barcode/photo/rank', () => {
    const bare: Item = { ...item, barcode: null, photoFileName: null, rankInCategory: null };
    expect(rowToItem(itemToRow(bare, OWNER))).toEqual(bare);
  });

  it('defends against malformed rows from the wire', () => {
    const row = itemToRow(item, OWNER) as unknown as Record<string, unknown>;
    row.reason_tags = null;
    row.notes = null;
    row.preference = 'garbage';
    const parsed = rowToItem(row as never);
    expect(parsed.reasonTags).toEqual([]);
    expect(parsed.notes).toBe('');
    expect(parsed.preference).toBe('like');
  });
});
