import { validateBackup } from '../src/storage/backup';
import { CURRENT_SCHEMA_VERSION } from '../src/storage/migrations';
import { SEED_REASON_TAGS } from '../src/storage/seedTags';

const goodItem = {
  id: 'i1',
  profileId: 'p1',
  name: 'Hot sauce',
  category: 'Condiments',
  brand: 'Frank',
  preference: 'dislike',
  reasonTags: ['Too spicy'],
  notes: 'way too hot',
  barcode: '0012345678905',
  photoFileName: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const goodBackup = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  profiles: [{ id: 'p1', name: 'Ryley', createdAt: '2026-01-01T00:00:00.000Z' }],
  items: [goodItem],
  reasonTags: ['Too spicy'],
  exportedAt: '2026-08-29T00:00:00.000Z',
  app: 'faviour',
};

describe('validateBackup', () => {
  it('accepts a well-formed backup and reports a summary', () => {
    const result = validateBackup(goodBackup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.snapshot.items[0].preference).toBe('dislike');
      expect(result.summary).toEqual({
        profileCount: 1,
        itemCount: 1,
        exportedAt: '2026-08-29T00:00:00.000Z',
      });
    }
  });

  it('rejects non-backup shapes', () => {
    for (const junk of [null, 42, 'hi', [], {}, { schemaVersion: 1 }]) {
      const result = validateBackup(junk);
      expect(result.ok).toBe(false);
    }
  });

  it('rejects backups from a newer app version with a helpful message', () => {
    const result = validateBackup({ ...goodBackup, schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/newer version/i);
    }
  });

  it('rejects damaged entries', () => {
    expect(validateBackup({ ...goodBackup, profiles: [{ id: 1 }] }).ok).toBe(false);
    expect(validateBackup({ ...goodBackup, items: [{ id: 'x' }] }).ok).toBe(false);
  });

  it('migrates an old (v0-era) export forward, seeding defaults', () => {
    const oldExport = {
      schemaVersion: 0,
      profiles: [{ id: 'p1', name: 'Ryley' }],
      items: [
        {
          id: 'i1',
          profileId: 'p1',
          name: 'Wings',
          category: 'Wings',
          brand: 'X',
          preference: 'like',
        },
      ],
      reasonTags: [],
    };
    const result = validateBackup(oldExport);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.snapshot.reasonTags).toEqual(SEED_REASON_TAGS);
      expect(result.snapshot.items[0].notes).toBe('');
      expect(result.snapshot.items[0].barcode).toBeNull();
    }
  });

  it('normalizes missing optional item fields and ignores unknown keys', () => {
    const result = validateBackup({
      ...goodBackup,
      futureField: 'ignored',
      items: [{ id: 'i1', profileId: 'p1', name: 'Thing', preference: 'like', extra: true }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.snapshot.items[0];
      expect(item.category).toBe('');
      expect(item.reasonTags).toEqual([]);
      expect(item.photoFileName).toBeNull();
    }
  });
});
