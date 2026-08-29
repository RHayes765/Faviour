import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSyncEnv } from './env';

// The narrow surface the sync engine and auth layer actually use — jest
// injects mocks typed against this instead of the full SupabaseClient.
export type SupabaseLike = Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>;

let client: SupabaseClient | null = null;
let initialized = false;

/**
 * Lazy singleton; null when the build has no Supabase config. The anon key +
 * row-level security is the ONLY client credential — the service-role key
 * must never appear in this app.
 */
export function getSupabase(): SupabaseClient | null {
  if (!initialized) {
    initialized = true;
    const env = getSyncEnv();
    if (env) {
      client = createClient(env.url, env.anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      });
    }
  }
  return client;
}
