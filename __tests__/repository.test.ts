import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncStorageRepository } from '../src/storage/asyncStorageRepository';
import { CURRENT_SCHEMA_VERSION } from '../src/storage/migrations';
import { SEED_REASON_TAGS } from '../src/storage/seedTags';
import type { NewItemInput } from '../src/types';

function makeRepo() {
  return new AsyncStorageRepository();
}

function itemInput(profileId: string, overrides: Partial<NewItemInput> = {}): NewItemInput {
  return {
    profileId,
    name: 'Spicy Chicken Tenders',
    category: 'Chicken Tenders',
    brand: "McDonald's",
    preference: 'like',
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('AsyncStorageRepository', () => {
  it('loads an empty, seeded database on first run and persists the schema version', async () => {
    const db = await makeRepo().load();
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.profiles).toEqual([]);
    expect(db.items).toEqual([]);
    expect(db.reasonTags).toEqual(SEED_REASON_TAGS);

    const meta = await AsyncStorage.getItem('@faviour:meta');
    expect(JSON.parse(meta!)).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION });
  });

  it('creates profiles and items with generated ids and timestamps', async () => {
    const repo = makeRepo();
    const profile = await repo.createProfile({ name: '  Ryley  ' });
    expect(profile.name).toBe('Ryley');
    expect(profile.id).toBeTruthy();
    expect(Date.parse(profile.createdAt)).not.toBeNaN();

    const item = await repo.createItem(itemInput(profile.id, { notes: undefined }));
    expect(item.id).toBeTruthy();
    expect(item.id).not.toBe(profile.id);
    expect(item.notes).toBe('');
    expect(item.barcode).toBeNull();
    expect(item.photoFileName).toBeNull();
    expect(item.createdAt).toBe(item.updatedAt);
  });

  it('does not lose writes when mutations race the initial load', async () => {
    const repo = makeRepo();
    // Both mutations fire before any load has hydrated the mirror; a
    // non-single-flighted load would clobber one of them.
    await Promise.all([
      repo.createProfile({ name: 'A' }),
      repo.createProfile({ name: 'B' }),
    ]);
    const db = await makeRepo().load();
    expect(db.profiles.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('persists across repository instances (fresh load sees prior writes)', async () => {
    const repo = makeRepo();
    const profile = await repo.createProfile({ name: 'Wife' });
    await repo.createItem(itemInput(profile.id));

    const db = await makeRepo().load();
    expect(db.profiles).toHaveLength(1);
    expect(db.items).toHaveLength(1);
    expect(db.items[0].name).toBe('Spicy Chicken Tenders');
  });

  it('updates items partially, bumps updatedAt, and keeps other fields', async () => {
    const repo = makeRepo();
    const profile = await repo.createProfile({ name: 'Ryley' });
    const item = await repo.createItem(itemInput(profile.id, { notes: 'pretty good' }));

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await repo.updateItem(item.id, { preference: 'dislike' });
    expect(updated.preference).toBe('dislike');
    expect(updated.notes).toBe('pretty good');
    expect(updated.name).toBe(item.name);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(item.updatedAt));
  });

  it('throws when updating a missing item', async () => {
    const repo = makeRepo();
    await repo.load();
    await expect(repo.updateItem('nope', { name: 'x' })).rejects.toThrow('Item not found');
  });

  it('deletes items', async () => {
    const repo = makeRepo();
    const profile = await repo.createProfile({ name: 'Ryley' });
    const item = await repo.createItem(itemInput(profile.id));
    await repo.deleteItem(item.id);
    const db = await makeRepo().load();
    expect(db.items).toEqual([]);
  });

  it('cascades item deletion when a profile is deleted', async () => {
    const repo = makeRepo();
    const keep = await repo.createProfile({ name: 'Keep' });
    const drop = await repo.createProfile({ name: 'Drop' });
    await repo.createItem(itemInput(keep.id, { name: 'kept item' }));
    await repo.createItem(itemInput(drop.id, { name: 'dropped item' }));

    await repo.deleteProfile(drop.id);

    const db = await makeRepo().load();
    expect(db.profiles.map((p) => p.name)).toEqual(['Keep']);
    expect(db.items.map((i) => i.name)).toEqual(['kept item']);
  });

  it('setCategoryRanks assigns 1..n, unranks unlisted, and is scoped + case-insensitive', async () => {
    const repo = makeRepo();
    const ryley = await repo.createProfile({ name: 'Ryley' });
    const sam = await repo.createProfile({ name: 'Sam' });
    const w1 = await repo.createItem(itemInput(ryley.id, { name: 'W1', category: 'Wings' }));
    const w2 = await repo.createItem(itemInput(ryley.id, { name: 'W2', category: 'wings' }));
    const w3 = await repo.createItem(itemInput(ryley.id, { name: 'W3', category: 'Wings' }));
    const samWings = await repo.createItem(itemInput(sam.id, { name: 'SamW', category: 'Wings' }));
    const dip = await repo.createItem(itemInput(ryley.id, { name: 'Dip', category: 'Dips' }));

    // rank w2 (case-different category) first, then w1; w3 left out → unranked
    const updated = await repo.setCategoryRanks(ryley.id, 'Wings', [w2.id, w1.id]);
    const byId = new Map(updated.map((i) => [i.id, i]));
    expect(byId.get(w2.id)!.rankInCategory).toBe(1);
    expect(byId.get(w1.id)!.rankInCategory).toBe(2);
    expect(byId.get(w3.id)!.rankInCategory).toBeNull();
    expect(byId.get(samWings.id)!.rankInCategory).toBeNull(); // other profile untouched
    expect(byId.get(dip.id)!.rankInCategory).toBeNull(); // other category untouched
    expect(byId.get(w2.id)!.updatedAt).toBe(w2.updatedAt); // ranking is not a "tried it" event

    // persists
    const db = await makeRepo().load();
    expect(db.items.find((i) => i.id === w2.id)!.rankInCategory).toBe(1);
  });

  it('clears rank when an item changes category or profile, keeps it on case-only edits', async () => {
    const repo = makeRepo();
    const ryley = await repo.createProfile({ name: 'Ryley' });
    const wings = await repo.createItem(itemInput(ryley.id, { name: 'W', category: 'Wings' }));
    await repo.setCategoryRanks(ryley.id, 'Wings', [wings.id]);

    const caseOnly = await repo.updateItem(wings.id, { category: 'WINGS' });
    expect(caseOnly.rankInCategory).toBe(1);

    const moved = await repo.updateItem(wings.id, { category: 'Tenders' });
    expect(moved.rankInCategory).toBeNull();
  });

  it('exportSnapshot returns the current data and importSnapshot(replace) swaps everything', async () => {
    const repo = makeRepo();
    const oldProfile = await repo.createProfile({ name: 'OldPhone' });
    await repo.createItem(itemInput(oldProfile.id, { name: 'old item' }));

    const exported = await repo.exportSnapshot();
    expect(exported.profiles).toHaveLength(1);
    expect(exported.items).toHaveLength(1);

    const incoming = {
      ...exported,
      profiles: [{ id: 'np', name: 'NewPhone', createdAt: '2026-01-01T00:00:00.000Z' }],
      items: [],
    };
    const replaced = await repo.importSnapshot(incoming, 'replace');
    expect(replaced.profiles.map((p) => p.name)).toEqual(['NewPhone']);
    expect(replaced.items).toEqual([]);

    // persisted: a fresh instance sees the replacement
    const db = await makeRepo().load();
    expect(db.profiles.map((p) => p.name)).toEqual(['NewPhone']);

    // and the pre-import backup preserves what was there before
    const backupRaw = await AsyncStorage.getItem('@faviour:pre-import-backup');
    const backup = JSON.parse(backupRaw!);
    expect(backup.profiles.map((p: { name: string }) => p.name)).toEqual(['OldPhone']);
    expect(backup.items).toHaveLength(1);
  });

  it('importSnapshot(merge) unions with existing data', async () => {
    const repo = makeRepo();
    const local = await repo.createProfile({ name: 'Ryley' });
    await repo.createItem(itemInput(local.id, { name: 'local item' }));

    const incoming = {
      schemaVersion: 1,
      profiles: [{ id: 'wife-p', name: 'Sam', createdAt: '2026-01-01T00:00:00.000Z' }],
      items: [
        {
          id: 'wife-i',
          profileId: 'wife-p',
          name: 'her item',
          category: 'Soda',
          brand: 'BigFizz',
          preference: 'like' as const,
          reasonTags: [],
          notes: '',
          barcode: null,
          photoFileName: null,
          rankInCategory: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      reasonTags: ['Her tag'],
    };
    const merged = await repo.importSnapshot(incoming, 'merge');
    expect(merged.profiles.map((p) => p.name).sort()).toEqual(['Ryley', 'Sam']);
    expect(merged.items.map((i) => i.name).sort()).toEqual(['her item', 'local item']);
    expect(merged.reasonTags).toContain('Her tag');
  });

  it('dedupes reason tags case-insensitively on items and in the tag list', async () => {
    const repo = makeRepo();
    const profile = await repo.createProfile({ name: 'Ryley' });
    const item = await repo.createItem(
      itemInput(profile.id, { reasonTags: ['Too salty', 'too salty', ' Great value '] }),
    );
    expect(item.reasonTags).toEqual(['Too salty', 'Great value']);

    const tags = await repo.addReasonTag('TOO SALTY');
    expect(tags.filter((t) => t.toLowerCase() === 'too salty')).toHaveLength(1);

    const added = await repo.addReasonTag('Smells funny');
    expect(added).toContain('Smells funny');
    const db = await makeRepo().load();
    expect(db.reasonTags).toContain('Smells funny');
  });
});
