import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncStorageRepository } from '../src/storage/asyncStorageRepository';
import { pullShared, syncOnce, SYNC_META_KEY } from '../src/sync/engine';
import type { SupabaseLike } from '../src/sync/supabaseClient';
import type { DbSnapshot } from '../src/types';

const USER = 'me-uuid';

interface Call {
  table: string;
  op: string;
  payload?: unknown;
}

// Chainable thenable mimicking the supabase query builder surface the
// engine touches. Each from() call resolves to the configured result.
function makeSupabase(config: {
  tables: Record<string, unknown[]>;
  failOn?: { table: string; op: string };
}) {
  const calls: Call[] = [];
  const supabase = {
    auth: {} as never,
    rpc: jest.fn(),
    from(table: string) {
      const state = { op: 'select', payload: undefined as unknown };
      const result = () => {
        calls.push({ table, op: state.op, payload: state.payload });
        if (config.failOn && config.failOn.table === table && config.failOn.op === state.op) {
          return { data: null, error: { message: 'boom' } };
        }
        if (state.op === 'select') {
          return { data: config.tables[table] ?? [], error: null };
        }
        return { data: null, error: null };
      };
      const builder: Record<string, unknown> = {};
      const chain = (name: string, effect?: (arg: unknown) => void) => {
        builder[name] = (arg: unknown) => {
          effect?.(arg);
          return builder;
        };
      };
      chain('select');
      chain('eq');
      chain('neq');
      chain('is');
      chain('in');
      chain('abortSignal');
      chain('upsert', (rows) => {
        state.op = 'upsert';
        state.payload = rows;
      });
      chain('update', (patch) => {
        state.op = 'update';
        state.payload = patch;
      });
      builder.maybeSingle = () => {
        state.op = 'maybeSingle';
        return builder;
      };
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject);
      return builder;
    },
  };
  return { supabase: supabase as unknown as SupabaseLike, calls };
}

function makeDeps(supabase: SupabaseLike, repo: AsyncStorageRepository) {
  const applied: DbSnapshot[] = [];
  return {
    deps: {
      supabase,
      repo,
      userId: USER,
      photoExists: () => false,
      applyLocal: async (merged: DbSnapshot) => {
        applied.push(merged);
        await repo.importSnapshot(merged, 'replace', { journalRemovals: false });
      },
    },
    applied,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('syncOnce', () => {
  it('pulls before pushing and pushes the merged state', async () => {
    const repo = new AsyncStorageRepository();
    const profile = await repo.createProfile({ name: 'Ryley' });
    await repo.createItem({
      profileId: profile.id,
      name: 'Wings',
      category: 'Wings',
      brand: 'B',
      preference: 'like',
    });

    const { supabase, calls } = makeSupabase({
      tables: { member_profiles: [], items: [], account_tags: [] },
    });
    const { deps, applied } = makeDeps(supabase, repo);
    await syncOnce(deps);

    const selects = calls.filter((c) => c.op === 'select' || c.op === 'maybeSingle');
    const writes = calls.filter((c) => c.op === 'upsert' || c.op === 'update');
    expect(selects.length).toBeGreaterThan(0);
    expect(writes.length).toBeGreaterThan(0);
    // every select happened before the first write
    const firstWrite = calls.findIndex((c) => c.op === 'upsert' || c.op === 'update');
    expect(calls.slice(0, firstWrite).every((c) => c.op === 'select' || c.op === 'maybeSingle')).toBe(true);
    // applied locally exactly once, with the merged snapshot
    expect(applied).toHaveLength(1);
    expect(applied[0].items).toHaveLength(1);
    // pushed items carry owner_id
    const itemUpsert = calls.find((c) => c.table === 'items' && c.op === 'upsert');
    expect((itemUpsert?.payload as { owner_id: string }[])[0].owner_id).toBe(USER);
    // meta stamped
    expect(await AsyncStorage.getItem(SYNC_META_KEY)).toBeTruthy();
  });

  it('pushes journal tombstones as updates and prunes only on success', async () => {
    const repo = new AsyncStorageRepository();
    const profile = await repo.createProfile({ name: 'Ryley' });
    const doomed = await repo.createItem({
      profileId: profile.id,
      name: 'Doomed',
      category: 'C',
      brand: 'B',
      preference: 'like',
    });
    await repo.deleteItem(doomed.id);
    expect(await repo.getTombstones()).toHaveLength(1);

    const { supabase, calls } = makeSupabase({
      tables: { member_profiles: [], items: [], account_tags: [] },
    });
    const { deps } = makeDeps(supabase, repo);
    await syncOnce(deps);

    const tombstoneUpdate = calls.find((c) => c.table === 'items' && c.op === 'update');
    expect(tombstoneUpdate).toBeTruthy();
    expect((tombstoneUpdate?.payload as { deleted_at: string }).deleted_at).toBeTruthy();
    expect(await repo.getTombstones()).toHaveLength(0); // pruned
  });

  it('keeps the journal when the push fails, and applies nothing remotely visible twice', async () => {
    const repo = new AsyncStorageRepository();
    const profile = await repo.createProfile({ name: 'Ryley' });
    await repo.createItem({
      profileId: profile.id,
      name: 'Keeper',
      category: 'C',
      brand: 'B',
      preference: 'like',
    });
    const doomed = await repo.createItem({
      profileId: profile.id,
      name: 'Doomed',
      category: 'C',
      brand: 'B',
      preference: 'like',
    });
    await repo.deleteItem(doomed.id);

    const { supabase } = makeSupabase({
      tables: { member_profiles: [], items: [], account_tags: [] },
      failOn: { table: 'items', op: 'upsert' },
    });
    const { deps } = makeDeps(supabase, repo);
    await expect(syncOnce(deps)).rejects.toThrow('push items');
    expect(await repo.getTombstones()).toHaveLength(1); // NOT pruned
    expect(await AsyncStorage.getItem(SYNC_META_KEY)).toBeNull(); // not stamped
  });

  it('chunks large item pushes', async () => {
    const repo = new AsyncStorageRepository();
    const profile = await repo.createProfile({ name: 'Ryley' });
    for (let i = 0; i < 250; i++) {
      await repo.createItem({
        profileId: profile.id,
        name: `item-${i}`,
        category: 'C',
        brand: 'B',
        preference: 'like',
      });
    }
    const { supabase, calls } = makeSupabase({
      tables: { member_profiles: [], items: [], account_tags: [] },
    });
    const { deps } = makeDeps(supabase, repo);
    await syncOnce(deps);
    const itemUpserts = calls.filter((c) => c.table === 'items' && c.op === 'upsert');
    expect(itemUpserts).toHaveLength(2); // 200 + 50
  }, 20000);
});

describe('pullShared', () => {
  it('returns empty with no active shares and skips data queries', async () => {
    const { supabase, calls } = makeSupabase({
      tables: { account_shares: [], member_profiles: [], items: [] },
    });
    const result = await pullShared({ supabase, userId: USER });
    expect(result.profiles).toEqual([]);
    expect(calls.filter((c) => c.table === 'member_profiles')).toHaveLength(0);
  });

  it('pulls shared rows and strips photo references', async () => {
    const { supabase } = makeSupabase({
      tables: {
        account_shares: [
          { id: 's1', owner_id: 'wife', grantee_id: USER, revoked_at: null, claimed_at: 'x' },
        ],
        member_profiles: [
          {
            id: 'wp',
            owner_id: 'wife',
            name: 'Sarah',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        items: [
          {
            id: 'wi',
            owner_id: 'wife',
            profile_id: 'wp',
            name: 'Her sauce',
            category: 'Sauce',
            brand: 'X',
            preference: 'like',
            reason_tags: [],
            notes: '',
            barcode: '0012345678905',
            photo_file_name: 'her-photo.jpg',
            rank_in_category: 1,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
    });
    const result = await pullShared({ supabase, userId: USER });
    expect(result.profiles.map((p) => p.name)).toEqual(['Sarah']);
    expect(result.items[0].photoFileName).toBeNull();
    expect(result.items[0].barcode).toBe('0012345678905');
    expect(result.ownerByProfile.wp).toBe('wife');
  });
});
