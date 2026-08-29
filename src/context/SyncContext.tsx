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
import { syncOnce, SYNC_META_KEY } from '../sync/engine';
import { getSupabase } from '../sync/supabaseClient';
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
  }, [session?.user?.id, importData]);

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

  const value = useMemo(
    () => ({
      available: Boolean(getSupabase()) && Boolean(session),
      syncing,
      lastSyncAt,
      lastError,
      syncNow,
    }),
    [session, syncing, lastSyncAt, lastError, syncNow],
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
