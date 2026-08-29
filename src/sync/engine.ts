import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FaviourRepository, Tombstone } from '../storage/repository';
import type { DbSnapshot } from '../types';
import { reconcile, reconcilePhotos, type RemoteState } from './plan';
import {
  itemToRow,
  profileToRow,
  rowToItem,
  rowToProfile,
  type ItemRow,
  type ProfileRow,
} from './rows';
import type { SupabaseLike } from './supabaseClient';

export const SYNC_META_KEY = '@faviour:syncmeta';
const CHUNK = 200;
const TIMEOUT_MS = 15_000;

export interface SyncDeps {
  supabase: SupabaseLike;
  repo: FaviourRepository;
  userId: string;
  /** Injectable for tests / web (photos are native-only). */
  photoExists: (fileName: string) => boolean;
  /**
   * Applies the reconciled snapshot to local storage AND refreshes UI state.
   * Must call repo.importSnapshot(merged, 'replace', { journalRemovals:
   * false }) under the hood.
   */
  applyLocal: (merged: DbSnapshot) => Promise<void>;
}

export interface SyncOutcome {
  ok: boolean;
  error?: string;
}

function chunked<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    out.push(rows.slice(i, i + CHUNK));
  }
  return out;
}

function withTimeout(): AbortSignal {
  // AbortSignal.timeout isn't guaranteed on Hermes; build it manually.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Under jest/node, don't let the timer hold the process open.
  (timer as unknown as { unref?: () => void }).unref?.();
  return controller.signal;
}

function throwIfError(error: { message: string } | null, step: string): void {
  if (error) {
    throw new Error(`${step}: ${error.message}`);
  }
}

/**
 * One full own-data sync: pull → reconcile (pure) → apply locally → push →
 * prune journal. Any failure leaves the journal and local state intact for
 * the next attempt. Single-flighting is the caller's job (SyncContext).
 */
export async function syncOnce(deps: SyncDeps): Promise<void> {
  const { supabase, repo, userId } = deps;

  const journal = await repo.getTombstones();
  const local = await repo.exportSnapshot();

  // PULL own rows, tombstoned included.
  const profilesRes = await supabase
    .from('member_profiles')
    .select('*')
    .eq('owner_id', userId)
    .abortSignal(withTimeout());
  throwIfError(profilesRes.error, 'pull profiles');
  const itemsRes = await supabase
    .from('items')
    .select('*')
    .eq('owner_id', userId)
    .abortSignal(withTimeout());
  throwIfError(itemsRes.error, 'pull items');
  const tagsRes = await supabase
    .from('account_tags')
    .select('tags')
    .eq('owner_id', userId)
    .abortSignal(withTimeout())
    .maybeSingle();
  throwIfError(tagsRes.error, 'pull tags');

  const remote: RemoteState = {
    profiles: (profilesRes.data ?? []) as ProfileRow[],
    items: (itemsRes.data ?? []) as ItemRow[],
    tags: ((tagsRes.data as { tags?: string[] } | null)?.tags ?? []) as string[],
  };

  // RECONCILE (pure) + photo hygiene.
  const merged = reconcile(local, journal, remote);
  merged.items = reconcilePhotos(local.items, merged.items, deps.photoExists);

  // APPLY locally first — the pushed state must be what the device now shows.
  await deps.applyLocal(merged);

  // PUSH: everything live, then tombstone updates.
  for (const chunk of chunked(merged.profiles.map((p) => profileToRow(p, userId)))) {
    const res = await supabase
      .from('member_profiles')
      .upsert(chunk)
      .abortSignal(withTimeout());
    throwIfError(res.error, 'push profiles');
  }
  for (const chunk of chunked(merged.items.map((i) => itemToRow(i, userId)))) {
    const res = await supabase.from('items').upsert(chunk).abortSignal(withTimeout());
    throwIfError(res.error, 'push items');
  }

  // Tombstones as UPDATEs (a row never uploaded simply matches nothing),
  // grouped by (kind, deletedAt) — profile cascades share one timestamp.
  const groups = new Map<string, Tombstone[]>();
  for (const t of journal) {
    const key = `${t.kind}|${t.deletedAt}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const group of groups.values()) {
    const table = group[0].kind === 'item' ? 'items' : 'member_profiles';
    const res = await supabase
      .from(table)
      .update({ deleted_at: group[0].deletedAt, updated_at: group[0].deletedAt })
      .eq('owner_id', userId)
      .in('id', group.map((t) => t.id))
      .abortSignal(withTimeout());
    throwIfError(res.error, 'push tombstones');
  }

  const tagsPush = await supabase
    .from('account_tags')
    .upsert({
      owner_id: userId,
      tags: merged.reasonTags,
      updated_at: new Date().toISOString(),
    })
    .abortSignal(withTimeout());
  throwIfError(tagsPush.error, 'push tags');

  // COMMIT bookkeeping only after a fully successful push.
  await repo.pruneTombstones(journal.map((t) => t.id));
  await AsyncStorage.setItem(
    SYNC_META_KEY,
    JSON.stringify({ lastSyncAt: new Date().toISOString() }),
  );
}

export interface SharedProfileData {
  shareId: string;
  ownerLabel: string;
  profiles: { id: string; name: string; createdAt: string }[];
}

export interface SharedPull {
  profiles: import('../types').Profile[];
  items: import('../types').Item[];
  /** Owning account's user id by profile id — the shared store joins this
   * with locally saved share labels for "Sarah (shared)" affordances. */
  ownerByProfile: Record<string, string>;
}

/**
 * Wholesale pull of everything shared WITH this user. RLS scopes the
 * queries; anything not ours that comes back is, by construction, shared.
 */
export async function pullShared(deps: {
  supabase: SupabaseLike;
  userId: string;
}): Promise<SharedPull> {
  const { supabase, userId } = deps;
  const sharesRes = await supabase
    .from('account_shares')
    .select('id, owner_id, grantee_id, revoked_at, claimed_at')
    .eq('grantee_id', userId)
    .abortSignal(withTimeout());
  throwIfError(sharesRes.error, 'pull shares');
  const activeOwners = new Set(
    ((sharesRes.data ?? []) as { owner_id: string; revoked_at: string | null }[])
      .filter((s) => !s.revoked_at)
      .map((s) => s.owner_id),
  );
  if (activeOwners.size === 0) {
    return { profiles: [], items: [], ownerByProfile: {} };
  }

  const profilesRes = await supabase
    .from('member_profiles')
    .select('*')
    .neq('owner_id', userId)
    .is('deleted_at', null)
    .abortSignal(withTimeout());
  throwIfError(profilesRes.error, 'pull shared profiles');
  const itemsRes = await supabase
    .from('items')
    .select('*')
    .neq('owner_id', userId)
    .is('deleted_at', null)
    .abortSignal(withTimeout());
  throwIfError(itemsRes.error, 'pull shared items');

  const profileRows = (profilesRes.data ?? []) as ProfileRow[];
  const ownerByProfile: Record<string, string> = {};
  for (const row of profileRows) {
    ownerByProfile[row.id] = row.owner_id;
  }
  return {
    profiles: profileRows.map(rowToProfile),
    items: ((itemsRes.data ?? []) as ItemRow[]).map((row) => ({
      ...rowToItem(row),
      photoFileName: null, // photos never sync in v1
    })),
    ownerByProfile,
  };
}
