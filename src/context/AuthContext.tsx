import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase, type SupabaseLike } from '../sync/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  /** False when the build has no Supabase config — all auth UI hides. */
  configured: boolean;
  initializing: boolean;
  session: Session | null;
  userEmail: string | null;
  /** 'google' | 'email' | … for the signed-in identity line. */
  provider: string | null;
  requestEmailOtp: (email: string) => Promise<AuthResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthResult>;
  signInWithProvider: (provider: 'google' | 'facebook' | 'twitter') => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const OAUTH_REDIRECT = 'faviour://auth-callback';

function friendlyError(message: string | undefined): string {
  const raw = message ?? 'Something went wrong';
  if (/rate limit/i.test(raw)) {
    return 'Too many attempts — wait a bit and try again.';
  }
  if (/invalid|expired/i.test(raw)) {
    return 'That code is invalid or expired. Request a new one.';
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [initializing, setInitializing] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);

  // Magic-link / OAuth deep-link handler: emailed sign-in links redirect to
  // faviour://auth-callback carrying either session tokens (implicit flow),
  // a PKCE code, or a token_hash — accept all three. This is the primary
  // real-device email path: the free-tier email template shows a link, not a
  // typed code.
  useEffect(() => {
    if (!supabase) {
      return;
    }
    const handleUrl = async (url: string | null) => {
      if (!url || !url.includes('auth-callback')) {
        return;
      }
      try {
        const parsed = new URL(url.replace('#', '?__hash__&')); // expose fragment params
        const params = parsed.searchParams;
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
        }
      } catch (e) {
        console.warn('Auth link handling failed', e);
      }
    };
    const sub = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });
    void Linking.getInitialURL().then((url) => handleUrl(url));
    return () => sub.remove();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setInitializing(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    // Supabase's documented RN pattern: refresh tokens only while foregrounded.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    });
    void supabase.auth.startAutoRefresh();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      appState.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, [supabase]);

  const requestEmailOtp = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Sync is not configured in this build.' };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          // The emailed link deep-links back into the app; a visible code (if
          // the email template includes one) can be typed instead.
          emailRedirectTo: OAUTH_REDIRECT,
        },
      });
      return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
    },
    [supabase],
  );

  const verifyEmailOtp = useCallback(
    async (email: string, token: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Sync is not configured in this build.' };
      }
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });
      return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
    },
    [supabase],
  );

  const signInWithProvider = useCallback(
    async (provider: 'google' | 'facebook' | 'twitter'): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Sync is not configured in this build.' };
      }
      if (Platform.OS === 'web') {
        return {
          ok: false,
          error: 'Use the email code in the web preview; provider sign-in works on the phone.',
        };
      }
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
        });
        if (error || !data?.url) {
          return { ok: false, error: friendlyError(error?.message) };
        }
        const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
        if (result.type !== 'success' || !result.url) {
          return { ok: false, error: 'Sign-in was cancelled.' };
        }
        const code = new URL(result.url).searchParams.get('code');
        if (!code) {
          return { ok: false, error: 'Sign-in did not complete. Try again.' };
        }
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        return exchangeError
          ? { ok: false, error: friendlyError(exchangeError.message) }
          : { ok: true };
      } catch (e) {
        console.error('OAuth sign-in failed', e);
        return { ok: false, error: 'Sign-in failed. Try again.' };
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  }, [supabase]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) {
      return { ok: false, error: 'Sync is not configured in this build.' };
    }
    const { error } = await (supabase as SupabaseLike).rpc('delete_account');
    if (error) {
      return { ok: false, error: friendlyError(error.message) };
    }
    await supabase.auth.signOut();
    return { ok: true };
  }, [supabase]);

  const value = useMemo(
    () => ({
      configured: Boolean(supabase),
      initializing,
      session,
      userEmail: session?.user?.email ?? null,
      provider: (session?.user?.app_metadata?.provider as string | undefined) ?? null,
      requestEmailOtp,
      verifyEmailOtp,
      signInWithProvider,
      signOut,
      deleteAccount,
    }),
    [
      supabase,
      initializing,
      session,
      requestEmailOtp,
      verifyEmailOtp,
      signInWithProvider,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
