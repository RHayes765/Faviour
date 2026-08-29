import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { repository } from '../storage/repositoryInstance';
import { pullShared, syncOnce, SYNC_META_KEY } from '../sync/engine';
import {
  clearShared,
  EMPTY_SHARED,
  loadShared,
  saveShared,
  type SharedState,
} from '../sync/sharedStore';
import { getSupabase } from '../sync/supabaseClient';
import type { Item, Profile } from '../types';
import { photoFileExists } from '../utils/photos';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';

const FOREGROUND_DEBOUNCE_MS = 60_000;

interface SyncContextValue {
  /** Configured build AND signed in. */
  available: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
  /** Read-only overlay of profiles/items shared WITH this account. */
  sharedProfiles: Profile[];
  sharedItems: Item[];
  /** "Sarah (shared)"-style label for a shared profile id. */
  sharedLabelFor: (profileId: string) => string | null;
  /** Records a friendly label for an owner at claim time. */
  rememberOwnerLabel: (ownerId: string, label: string) => Promise<void>;
  refreshShared: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { importData } = useData();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const lastForegroundSync = useRef(0);
  const [shared, setShared] = useState<SharedState>(EMPTY_SHARED);

  useEffect(() => {
    void AsyncStorage.getItem(SYNC_META_KEY).then((raw) => {
      try {
        const meta = raw ? (JSON.parse(raw) as { lastSyncAt?: string }) : null;
        if (meta?.lastSyncAt) {
          setLastSyncAt(meta.lastSyncAt);
        }
      } catch {
        // ignore corrupt meta
      }
    });
    void loadShared().then(setShared);
  }, []);

  // Sign-out clears the shared overlay and sync bookkeeping; own data stays.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (session?.user?.id) {
      wasSignedIn.current = true;
      return;
    }
    if (wasSignedIn.current) {
      wasSignedIn.current = false;
      setShared(EMPTY_SHARED);
      setLastSyncAt(null);
      void clearShared();
      void AsyncStorage.removeItem(SYNC_META_KEY);
    }
  }, [session?.user?.id]);

  const refreshShared = useCallback(async () => {
    const supabase = getSupabase();
    const userId = session?.user?.id;
    if (!supabase || !userId) {
      return;
    }
    try {
      const pulled = await pullShared({ supabase, userId });
      setShared((prev) => {
        const next: SharedState = {
          profiles: pulled.profiles,
          items: pulled.items,
          ownerByProfile: pulled.ownerByProfile,
          labelByOwner: prev.labelByOwner,
        };
        void saveShared(next);
        return next;
      });
    } catch (e) {
      console.warn('Shared pull failed', e);
    }
  }, [session?.user?.id]);

  const rememberOwnerLabel = useCallback(async (ownerId: string, label: string) => {
    setShared((prev) => {
      const next = {
        ...prev,
        labelByOwner: { ...prev.labelByOwner, [ownerId]: label },
      };
      void saveShared(next);
      return next;
    });
  }, []);

  const syncNow = useCallback(async () => {
    const supabase = getSupabase();
    const userId = session?.user?.id;
    if (!supabase || !userId) {
      return;
    }
    if (inFlight.current) {
      return inFlight.current; // coalesce concurrent triggers
    }
    setSyncing(true);
    setLastError(null);
    const run = (async () => {
      try {
        await syncOnce({
          supabase,
          repo: repository,
          userId,
          photoExists: photoFileExists,
          applyLocal: (merged) =>
            importData(merged, 'replace', { journalRemovals: false }),
        });
        const now = new Date().toISOString();
        setLastSyncAt(now);
        await refreshShared();
      } catch (e) {
        console.warn('Sync failed', e);
        setLastError(e instanceof Error ? e.message : 'Sync failed');
      } finally {
        setSyncing(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [session?.user?.id, importData, refreshShared]);

  // Sync shortly after sign-in.
  useEffect(() => {
    if (session?.user?.id) {
      void syncNow();
    }
  }, [session?.user?.id, syncNow]);

  // Foreground trigger with debounce.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session?.user?.id) {
        const now = Date.now();
        if (now - lastForegroundSync.current > FOREGROUND_DEBOUNCE_MS) {
          lastForegroundSync.current = now;
          void syncNow();
        }
      }
    });
    return () => sub.remove();
  }, [session?.user?.id, syncNow]);

  const sharedLabelFor = useCallback(
    (profileId: string): string | null => {
      const ownerId = shared.ownerByProfile[profileId];
      if (!ownerId) {
        return null;
      }
      const label = shared.labelByOwner[ownerId];
      return label ? label.split('@')[0] : 'shared';
    },
    [shared],
  );

  const value = useMemo(
    () => ({
      available: Boolean(getSupabase()) && Boolean(session),
      syncing,
      lastSyncAt,
      lastError,
      syncNow,
      sharedProfiles: shared.profiles,
      sharedItems: shared.items,
      sharedLabelFor,
      rememberOwnerLabel,
      refreshShared,
    }),
    [
      session,
      syncing,
      lastSyncAt,
      lastError,
      syncNow,
      shared,
      sharedLabelFor,
      rememberOwnerLabel,
      refreshShared,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) {
    throw new Error('useSync must be used inside SyncProvider');
  }
  return value;
}
