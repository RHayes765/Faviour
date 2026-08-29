import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { getSupabase } from '../sync/supabaseClient';
import { colors } from '../theme';
import { confirmDestructive, showAlert } from '../utils/confirm';

interface GrantedShare {
  id: string;
  grantee_email: string | null;
  code: string;
  claimed_at: string | null;
  revoked_at: string | null;
}

interface ReceivedShare {
  id: string;
  owner_id: string;
  revoked_at: string | null;
}

export function SharingSection() {
  const { session } = useAuth();
  const sync = useSync();
  const [granted, setGranted] = useState<GrantedShare[]>([]);
  const [received, setReceived] = useState<ReceivedShare[]>([]);
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [busy, setBusy] = useState(false);
  const userId = session?.user?.id;

  const refreshShares = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) {
      return;
    }
    const grantedRes = await supabase
      .from('account_shares')
      .select('id, grantee_email, code, claimed_at, revoked_at')
      .eq('owner_id', userId);
    if (!grantedRes.error && grantedRes.data) {
      setGranted(grantedRes.data as GrantedShare[]);
    }
    const receivedRes = await supabase
      .from('account_shares')
      .select('id, owner_id, revoked_at')
      .eq('grantee_id', userId);
    if (!receivedRes.error && receivedRes.data) {
      setReceived((receivedRes.data as ReceivedShare[]).filter((s) => !s.revoked_at));
    }
  }, [userId]);

  useEffect(() => {
    void refreshShares();
  }, [refreshShares]);

  if (!userId) {
    return null;
  }

  const handleCreateCode = async () => {
    const supabase = getSupabase();
    if (!supabase || busy) {
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_share_code');
      if (error) {
        showAlert('Sharing', error.message);
        return;
      }
      setFreshCode(String(data));
      await refreshShares();
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    const supabase = getSupabase();
    if (!supabase || busy || claimCode.trim().length < 8) {
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('claim_share_code', {
        p_code: claimCode.trim(),
      });
      if (error) {
        showAlert(
          'Share code',
          /invalid_or_expired/.test(error.message)
            ? 'That code is invalid or expired — ask for a fresh one.'
            : /cannot_claim_own/.test(error.message)
              ? "That's your own code — enter it on the other person's phone."
              : error.message,
        );
        return;
      }
      const row = Array.isArray(data)
        ? (data[0] as { share_id?: string; owner_email?: string } | undefined)
        : null;
      setClaimCode('');
      await refreshShares();
      if (row?.owner_email) {
        // The claimed share's owner gets a friendly label for the overlay UI.
        const supabase2 = getSupabase();
        if (supabase2 && row.share_id) {
          const shareRes = await supabase2
            .from('account_shares')
            .select('owner_id')
            .eq('id', row.share_id)
            .maybeSingle();
          const ownerId = (shareRes.data as { owner_id?: string } | null)?.owner_id;
          if (ownerId) {
            await sync.rememberOwnerLabel(ownerId, row.owner_email);
          }
        }
      }
      await sync.refreshShared();
      showAlert('Connected', 'Their shared list is now on your phone.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = (share: GrantedShare) => {
    confirmDestructive({
      title: 'Stop sharing?',
      message: `${share.grantee_email || 'This person'} will lose access to your list on their next sync.`,
      confirmLabel: 'Stop sharing',
      onConfirm: () => {
        void (async () => {
          const supabase = getSupabase();
          if (!supabase) {
            return;
          }
          await supabase
            .from('account_shares')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', share.id);
          await refreshShares();
        })();
      },
    });
  };

  const handleLeave = (share: ReceivedShare) => {
    confirmDestructive({
      title: 'Remove shared list?',
      message: 'Their items disappear from your phone. They can share a new code later.',
      confirmLabel: 'Remove',
      onConfirm: () => {
        void (async () => {
          const supabase = getSupabase();
          if (!supabase) {
            return;
          }
          await supabase.from('account_shares').delete().eq('id', share.id);
          await refreshShares();
          await sync.refreshShared();
        })();
      },
    });
  };

  const activeGranted = granted.filter((s) => !s.revoked_at && s.claimed_at);
  const pendingCodes = granted.filter((s) => !s.revoked_at && !s.claimed_at);

  return (
    <View>
      <Text style={styles.sectionLabel}>Sharing</Text>
      <View style={styles.card}>
      {busy ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}

      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.disabled]}
        disabled={busy}
        onPress={handleCreateCode}
      >
        <Ionicons name="person-add-outline" size={16} color="white" />
        <Text style={styles.primaryButtonText}>Share my list</Text>
      </TouchableOpacity>
      {freshCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{freshCode}</Text>
          <Text style={styles.codeHint}>
            Have them enter this code on their phone. Single use, expires in 48h.
          </Text>
        </View>
      ) : null}

      <View style={styles.claimRow}>
        <TextInput
          style={styles.input}
          value={claimCode}
          onChangeText={(text) => setClaimCode(text.toUpperCase())}
          placeholder="Enter share code"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />
        <TouchableOpacity
          style={[
            styles.claimButton,
            (claimCode.trim().length < 8 || busy) && styles.disabled,
          ]}
          disabled={claimCode.trim().length < 8 || busy}
          onPress={() => {
            void handleClaim();
          }}
        >
          <Text style={styles.claimButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>

      {activeGranted.length > 0 ? (
        <>
          <Text style={styles.listLabel}>Sharing with</Text>
          {activeGranted.map((share) => (
            <View key={share.id} style={styles.shareRow}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.shareRowText} numberOfLines={1}>
                {share.grantee_email || 'Connected'}
              </Text>
              <TouchableOpacity onPress={() => handleRevoke(share)}>
                <Text style={styles.revokeText}>Stop</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}
      {pendingCodes.length > 0 ? (
        <Text style={styles.pendingText}>
          {pendingCodes.length} unclaimed code{pendingCodes.length !== 1 ? 's' : ''} outstanding
        </Text>
      ) : null}

      {received.length > 0 ? (
        <>
          <Text style={styles.listLabel}>Shared with me</Text>
          {received.map((share) => (
            <View key={share.id} style={styles.shareRow}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.shareRowText}>
                {sync.sharedProfiles.length > 0
                  ? sync.sharedProfiles
                      .map((p) => p.name)
                      .slice(0, 3)
                      .join(', ')
                  : 'Waiting for first sync'}
              </Text>
              <TouchableOpacity onPress={() => handleLeave(share)}>
                <Text style={styles.revokeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
  },
  spinner: {
    marginBottom: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  codeBox: {
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#EAF3FF',
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  codeHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  claimRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    letterSpacing: 2,
    backgroundColor: colors.background,
    color: colors.text,
  },
  claimButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  claimButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  listLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  shareRowText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  revokeText: {
    color: colors.dislike,
    fontSize: 13,
    fontWeight: '500',
  },
  pendingText: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
