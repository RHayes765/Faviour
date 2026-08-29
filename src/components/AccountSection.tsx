import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { confirmDestructive, showAlert } from '../utils/confirm';

// Provider-generic sign-in list: adding Meta/X later is one entry here plus
// enabling the provider in the Supabase dashboard — no new code paths.
const OAUTH_PROVIDERS: {
  id: 'google' | 'facebook' | 'twitter';
  label: string;
  icon: 'logo-google' | 'logo-facebook' | 'logo-twitter';
}[] = [{ id: 'google', label: 'Continue with Google', icon: 'logo-google' }];

export function AccountSection() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (!auth.configured) {
    return (
      <View style={styles.card}>
        <Text style={styles.mutedText}>
          Sync isn&apos;t configured in this build — everything works offline as
          usual.
        </Text>
      </View>
    );
  }

  if (auth.initializing) {
    return (
      <View style={[styles.card, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await fn();
      if (!result.ok && result.error) {
        showAlert('Sign in', result.error);
      }
      return result;
    } finally {
      setBusy(false);
    }
  };

  if (auth.session) {
    return (
      <View style={styles.card}>
        <View style={styles.identityRow}>
          <Ionicons
            name={auth.provider === 'google' ? 'logo-google' : 'mail-outline'}
            size={20}
            color={colors.textSecondary}
          />
          <Text style={styles.identityText}>{auth.userEmail ?? 'Signed in'}</Text>
        </View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            void auth.signOut();
          }}
        >
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerLink}
          onPress={() =>
            confirmDestructive({
              title: 'Delete account?',
              message:
                'This permanently removes your account and all synced data from the cloud. Data on this phone stays.',
              confirmLabel: 'Delete account',
              onConfirm: () => {
                void run(auth.deleteAccount).then((result) => {
                  if (result?.ok) {
                    showAlert('Account deleted', 'Your cloud data is gone. Local data is untouched.');
                  }
                });
              },
            })
          }
        >
          <Text style={styles.dangerLinkText}>Delete account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.mutedText}>
        Optional — sign in to back up your data and share lists. Everything keeps
        working offline.
      </Text>

      {OAUTH_PROVIDERS.map((provider) => (
        <TouchableOpacity
          key={provider.id}
          style={[styles.providerButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() => {
            void run(() => auth.signInWithProvider(provider.id));
          }}
        >
          <Ionicons name={provider.icon} size={18} color={colors.text} />
          <Text style={styles.providerButtonText}>{provider.label}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or email me a code</Text>
        <View style={styles.dividerLine} />
      </View>

      {!codeSent ? (
        <View style={styles.emailRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!email.includes('@') || busy) && styles.disabled]}
            disabled={!email.includes('@') || busy}
            onPress={() => {
              void run(() => auth.requestEmailOtp(email)).then((result) => {
                if (result?.ok) {
                  setCodeSent(true);
                }
              });
            }}
          >
            <Text style={styles.sendButtonText}>Send code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.mutedText}>
            Enter the 6-digit code sent to {email.trim()}
          </Text>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendButton, (code.trim().length < 6 || busy) && styles.disabled]}
              disabled={code.trim().length < 6 || busy}
              onPress={() => {
                void run(() => auth.verifyEmailOtp(email, code)).then((result) => {
                  if (result?.ok) {
                    setCodeSent(false);
                    setCode('');
                    setEmail('');
                  }
                });
              }}
            >
              <Text style={styles.sendButtonText}>Verify</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              setCodeSent(false);
              setCode('');
            }}
          >
            <Text style={styles.linkText}>Different email</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
  },
  centered: {
    alignItems: 'center',
  },
  mutedText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  identityText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
  },
  providerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.chipBackground,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textFaint,
  },
  emailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.text,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    marginTop: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  dangerLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  dangerLinkText: {
    color: colors.dislike,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.5,
  },
});
