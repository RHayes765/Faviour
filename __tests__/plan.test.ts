import { CURRENT_SCHEMA_VERSION } from '../src/storage/migrations';
import type { Tombstone } from '../src/storage/repository';
import { reconcile, reconcilePhotos, type RemoteState } from '../src/sync/plan';
import { itemToRow, profileToRow } from '../src/sync/rows';
import type { DbSnapshot, Item, Profile } from '../src/types';

const OWNER = 'me';

function profile(id: string, name: string, createdAt = '2026-01-01T00:00:00.000Z'): Profile {
  return { id, name, createdAt };
}

function item(id: string, profileId: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    profileId,
    name: `item-${id}`,
    category: 'Wings',
    brand: 'Brand',
    preference: 'like',
    reasonTags: [],
    notes: '',
    barcode: null,
    photoFileName: null,
    rankInCategory: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

function snapshot(profiles: Profile[], items: Item[], reasonTags: string[] = []): DbSnapshot {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, profiles, items, reasonTags };
}

function remote(
  profiles: Profile[],
  items: Item[],
  opts: {
    tags?: string[];
    itemTombstones?: Record<string, string>;
    profileTombstones?: Record<string, string>;
    itemUpdatedAt?: Record<string, string>;
  } = {},
): RemoteState {
  return {
    profiles: profiles.map((p) => ({
      ...profileToRow(p, OWNER),
      deleted_at: opts.profileTombstones?.[p.id] ?? null,
    })),
    items: items.map((i) => ({
      ...itemToRow(i, OWNER),
      updated_at: opts.itemUpdatedAt?.[i.id] ?? i.updatedAt,
      deleted_at: opts.itemTombstones?.[i.id] ?? null,
    })),
    tags: opts.tags ?? [],
  };
}

describe('reconcile', () => {
  it('fresh push: empty remote leaves local untouched', () => {
    const local = snapshot([profile('p1', 'Ryley')], [item('a', 'p1')], ['Tag']);
    const merged = reconcile(local, [], remote([], []));
    expect(merged.profiles).toHaveLength(1);
    expect(merged.items).toHaveLength(1);
    expect(merged.reasonTags).toEqual(['Tag']);
  });

  it('pull into empty: remote fills an empty device', () => {
    const merged = reconcile(
      snapshot([], []),
      [],
      remote([profile('p1', 'Ryley')], [item('a', 'p1')], { tags: ['T'] }),
    );
    expect(merged.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(merged.items.map((i) => i.id)).toEqual(['a']);
    expect(merged.reasonTags).toEqual(['T']);
  });

  it('two-sided merge: newer updatedAt wins per item', () => {
    const local = snapshot(
      [profile('p1', 'Ryley')],
      [
        item('a', 'p1', { notes: 'local newer', updatedAt: '2026-03-01T00:00:00.000Z' }),
        item('b', 'p1', { notes: 'local older', updatedAt: '2026-01-01T00:00:00.000Z' }),
      ],
    );
    const rem = remote(
      [profile('p1', 'Ryley')],
      [
        item('a', 'p1', { notes: 'remote older', updatedAt: '2026-02-01T00:00:00.000Z' }),
        item('b', 'p1', { notes: 'remote newer', updatedAt: '2026-02-01T00:00:00.000Z' }),
      ],
    );
    const merged = reconcile(local, [], rem);
    const notes = Object.fromEntries(merged.items.map((i) => [i.id, i.notes]));
    expect(notes).toEqual({ a: 'local newer', b: 'remote newer' });
  });

  it('remote tombstone beats an older local row', () => {
    const local = snapshot(
      [profile('p1', 'Ryley')],
      [item('a', 'p1', { updatedAt: '2026-01-05T00:00:00.000Z' })],
    );
    const rem = remote([profile('p1', 'Ryley')], [item('a', 'p1')], {
      itemTombstones: { a: '2026-02-01T00:00:00.000Z' },
    });
    const merged = reconcile(local, [], rem);
    expect(merged.items).toHaveLength(0);
  });

  it('a local edit NEWER than the remote tombstone resurrects the item', () => {
    const local = snapshot(
      [profile('p1', 'Ryley')],
      [item('a', 'p1', { updatedAt: '2026-03-01T00:00:00.000Z', notes: 're-tried it' })],
    );
    const rem = remote([profile('p1', 'Ryley')], [item('a', 'p1')], {
      itemTombstones: { a: '2026-02-01T00:00:00.000Z' },
    });
    const merged = reconcile(local, [], rem);
    expect(merged.items.map((i) => i.notes)).toEqual(['re-tried it']);
  });

  it('local journal filters remote rows older than the local delete', () => {
    const journal: Tombstone[] = [
      { kind: 'item', id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const rem = remote(
      [profile('p1', 'Ryley')],
      [item('a', 'p1', { updatedAt: '2026-01-15T00:00:00.000Z' })],
    );
    const merged = reconcile(snapshot([profile('p1', 'Ryley')], []), journal, rem);
    expect(merged.items).toHaveLength(0);
  });

  it('a remote edit NEWER than the local delete survives the journal', () => {
    const journal: Tombstone[] = [
      { kind: 'item', id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const rem = remote(
      [profile('p1', 'Ryley')],
      [item('a', 'p1', { updatedAt: '2026-02-15T00:00:00.000Z', notes: 'other device edited' })],
    );
    const merged = reconcile(snapshot([profile('p1', 'Ryley')], []), journal, rem);
    expect(merged.items.map((i) => i.notes)).toEqual(['other device edited']);
  });

  it('remote profile tombstone cascades local items of that profile', () => {
    const local = snapshot(
      [profile('p1', 'Doomed', '2026-01-01T00:00:00.000Z')],
      [item('a', 'p1'), item('b', 'p1')],
    );
    const rem = remote([profile('p1', 'Doomed')], [], {
      profileTombstones: { p1: '2026-02-01T00:00:00.000Z' },
    });
    const merged = reconcile(local, [], rem);
    expect(merged.profiles).toHaveLength(0);
    expect(merged.items).toHaveLength(0);
  });

  it('journaled profile delete filters the remote profile AND its remote items', () => {
    const journal: Tombstone[] = [
      { kind: 'profile', id: 'p1', deletedAt: '2026-02-01T00:00:00.000Z' },
      { kind: 'item', id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const rem = remote(
      [profile('p1', 'Gone', '2026-01-01T00:00:00.000Z')],
      [item('a', 'p1', { updatedAt: '2026-01-15T00:00:00.000Z' })],
    );
    const merged = reconcile(snapshot([], []), journal, rem);
    expect(merged.profiles).toHaveLength(0);
    expect(merged.items).toHaveLength(0);
  });

  it('tags union case-insensitively across sides', () => {
    const merged = reconcile(
      snapshot([], [], ['Too salty', 'Bland']),
      [],
      remote([], [], { tags: ['too salty', 'Kids loved it'] }),
    );
    expect(merged.reasonTags).toEqual(['Too salty', 'Bland', 'Kids loved it']);
  });
});

describe('reconcilePhotos', () => {
  const base = item('a', 'p1');

  it('keeps the local photo when the remote-won filename is missing locally', () => {
    const local = [{ ...base, photoFileName: 'local.jpg' }];
    const merged = [{ ...base, photoFileName: 'other-device.jpg' }];
    const out = reconcilePhotos(local, merged, (name) => name === 'local.jpg');
    expect(out[0].photoFileName).toBe('local.jpg');
  });

  it('nulls the photo when neither file exists locally', () => {
    const local = [{ ...base, photoFileName: 'gone.jpg' }];
    const merged = [{ ...base, photoFileName: 'other-device.jpg' }];
    const out = reconcilePhotos(local, merged, () => false);
    expect(out[0].photoFileName).toBeNull();
  });

  it('leaves an existing local file reference alone', () => {
    const merged = [{ ...base, photoFileName: 'mine.jpg' }];
    const out = reconcilePhotos(merged, merged, () => true);
    expect(out[0].photoFileName).toBe('mine.jpg');
  });
});
