import { mergeSnapshots } from '../src/storage/merge';
import { CURRENT_SCHEMA_VERSION } from '../src/storage/migrations';
import type { DbSnapshot, Item, Profile } from '../src/types';

function profile(id: string, name: string): Profile {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function item(id: string, profileId: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    profileId,
    name: 'Thing',
    category: 'Category',
    brand: 'Brand',
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

function snapshot(overrides: Partial<DbSnapshot> = {}): DbSnapshot {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: [],
    items: [],
    reasonTags: [],
    ...overrides,
  };
}

describe('mergeSnapshots', () => {
  it('unions items by id and appends unknown profiles', () => {
    const local = snapshot({
      profiles: [profile('p1', 'Ryley')],
      items: [item('i1', 'p1')],
    });
    const incoming = snapshot({
      profiles: [profile('p2', 'Sam')],
      items: [item('i2', 'p2')],
    });
    const merged = mergeSnapshots(local, incoming);
    expect(merged.profiles.map((p) => p.name).sort()).toEqual(['Ryley', 'Sam']);
    expect(merged.items.map((i) => i.id).sort()).toEqual(['i1', 'i2']);
  });

  it('matches profiles by case-insensitive name and remaps item profileIds', () => {
    const local = snapshot({ profiles: [profile('local-mom', 'Mom')] });
    const incoming = snapshot({
      profiles: [profile('other-mom', '  mom ')],
      items: [item('i9', 'other-mom')],
    });
    const merged = mergeSnapshots(local, incoming);
    expect(merged.profiles).toHaveLength(1);
    expect(merged.profiles[0].id).toBe('local-mom');
    expect(merged.items[0].profileId).toBe('local-mom');
  });

  it('keeps the newer updatedAt on item id collisions, local on ties', () => {
    const local = snapshot({
      profiles: [profile('p1', 'Ryley')],
      items: [
        item('stale', 'p1', { notes: 'local old', updatedAt: '2026-01-01T00:00:00.000Z' }),
        item('tie', 'p1', { notes: 'local tie', updatedAt: '2026-02-01T00:00:00.000Z' }),
        item('fresh', 'p1', { notes: 'local new', updatedAt: '2026-03-01T00:00:00.000Z' }),
      ],
    });
    const incoming = snapshot({
      profiles: [profile('p1', 'Ryley')],
      items: [
        item('stale', 'p1', { notes: 'incoming new', updatedAt: '2026-02-15T00:00:00.000Z' }),
        item('tie', 'p1', { notes: 'incoming tie', updatedAt: '2026-02-01T00:00:00.000Z' }),
        item('fresh', 'p1', { notes: 'incoming old', updatedAt: '2026-01-15T00:00:00.000Z' }),
      ],
    });
    const merged = mergeSnapshots(local, incoming);
    const notes = Object.fromEntries(merged.items.map((i) => [i.id, i.notes]));
    expect(notes).toEqual({
      stale: 'incoming new',
      tie: 'local tie',
      fresh: 'local new',
    });
  });

  it('unions reason tags case-insensitively keeping first spelling', () => {
    const local = snapshot({ reasonTags: ['Too salty', 'Great value'] });
    const incoming = snapshot({ reasonTags: ['too salty', 'Kids loved it'] });
    const merged = mergeSnapshots(local, incoming);
    expect(merged.reasonTags).toEqual(['Too salty', 'Great value', 'Kids loved it']);
  });
});
