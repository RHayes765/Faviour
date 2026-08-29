export interface SyncEnv {
  url: string;
  anonKey: string;
}

/**
 * Sync/cloud configuration, inlined at bundle time from EXPO_PUBLIC_* vars.
 * Returns null when unconfigured — the app must boot and work fully offline
 * with no .env present; callers treat null as "sync not available in this
 * build" and never throw.
 */
export function getSyncEnv(): SyncEnv | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('your-project-ref')) {
    return null;
  }
  return { url, anonKey };
}
