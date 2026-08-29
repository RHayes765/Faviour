import { CURRENT_SCHEMA_VERSION, runMigrations } from '../src/storage/migrations';
import { SEED_REASON_TAGS } from '../src/storage/seedTags';
import type { Item, Profile } from '../src/types';

describe('runMigrations', () => {
  it('initializes an empty database from version 0 with seeded tags', () => {
    const db = runMigrations({}, 0);
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.profiles).toEqual([]);
    expect(db.items).toEqual([]);
    expect(db.reasonTags).toEqual(SEED_REASON_TAGS);
  });

  it('preserves existing data when migrating from version 0', () => {
    const profile: Profile = {
      id: 'p1',
      name: 'Ryley',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const item = { id: 'i1', profileId: 'p1', name: 'Hot sauce' } as Item;
    const db = runMigrations(
      { profiles: [profile], items: [item], reasonTags: ['Custom tag'] },
      0,
    );
    expect(db.profiles).toEqual([profile]);
    expect(db.items).toEqual([{ ...item, rankInCategory: null }]);
    expect(db.reasonTags).toEqual(['Custom tag']);
  });

  it('is a no-op when already at the current version', () => {
    const db = runMigrations({ profiles: [], items: [], reasonTags: ['x'] }, CURRENT_SCHEMA_VERSION);
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.reasonTags).toEqual(['x']);
  });

  it('v2 adds rankInCategory: null to v1 items without touching existing values', () => {
    const v1Item = { id: 'i1', profileId: 'p1', name: 'Wings' } as Item;
    const alreadyRanked = { id: 'i2', profileId: 'p1', name: 'Dip', rankInCategory: 3 } as Item;
    const db = runMigrations({ profiles: [], items: [v1Item, alreadyRanked], reasonTags: ['x'] }, 1);
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.items[0].rankInCategory).toBeNull();
    expect(db.items[1].rankInCategory).toBe(3);
  });

  it('chains v0 → current: seeds tags and adds rank field', () => {
    const db = runMigrations({ items: [{ id: 'i1' } as Item] }, 0);
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.reasonTags).toEqual(SEED_REASON_TAGS);
    expect(db.items[0].rankInCategory).toBeNull();
  });

  it('throws when a migration step is missing', () => {
    expect(() => runMigrations({}, -5)).toThrow(/Missing migration/);
  });
});
