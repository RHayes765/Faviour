import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { validateBackup, type BackupSummary } from '../storage/backup';
import { colors } from '../theme';
import type { DbSnapshot } from '../types';
import { confirmDestructive, showAlert } from '../utils/confirm';
import { pruneMissingPhotos } from '../utils/photos';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface PendingImport {
  snapshot: DbSnapshot;
  summary: BackupSummary;
}

export function SettingsScreen(_props: Props) {
  const { profiles, items, exportData, importData } = useData();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);

  const handleExport = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        showAlert('Not available here', 'Export works on your phone, not the web preview.');
        return;
      }
      const snapshot = await exportData();
      const payload = JSON.stringify({
        ...snapshot,
        exportedAt: new Date().toISOString(),
        app: 'faviour',
      });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const file = new File(Paths.cache, `faviour-backup-${stamp}.json`);
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(payload);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your Faviour backup',
      });
    } catch (e) {
      console.error('Export failed', e);
      showAlert('Export failed', 'Something went wrong creating the backup. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickImport = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Android pickers often mislabel .json files; content validation below
        // is the real gate.
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const uri = result.assets[0].uri;
      const text =
        Platform.OS === 'web'
          ? await (await fetch(uri)).text()
          : await new File(uri).text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        showAlert('Not a backup', "That file isn't a Faviour backup.");
        return;
      }
      const validation = validateBackup(parsed);
      if (!validation.ok) {
        showAlert("Can't import", validation.reason);
        return;
      }
      setPending({
        snapshot: {
          ...validation.snapshot,
          items: pruneMissingPhotos(validation.snapshot.items),
        },
        summary: validation.summary,
      });
    } catch (e) {
      console.error('Import failed', e);
      showAlert('Import failed', "Couldn't read that file. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async (mode: 'merge' | 'replace') => {
    if (!pending) {
      return;
    }
    setBusy(true);
    try {
      await importData(pending.snapshot, mode);
      setPending(null);
      showAlert('Import complete', 'Your data has been updated.');
    } catch (e) {
      console.error('Import failed', e);
      showAlert('Import failed', 'Something went wrong applying the backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Your data</Text>
      <View style={styles.card}>
        <Text style={styles.dataLine}>
          {profiles.length} profile{profiles.length !== 1 ? 's' : ''} ·{' '}
          {items.length} item{items.length !== 1 ? 's' : ''} — stored only on this
          device
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Backup</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.actionRow, busy && styles.disabled]}
          onPress={handleExport}
          disabled={busy}
        >
          <Ionicons name="share-outline" size={22} color={colors.primary} />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Export backup</Text>
            <Text style={styles.actionSubtitle}>
              Saves everything except photos as a file you can keep or send to
              another phone
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.actionRow, busy && styles.disabled]}
          onPress={handlePickImport}
          disabled={busy}
        >
          <Ionicons name="download-outline" size={22} color={colors.primary} />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Import backup</Text>
            <Text style={styles.actionSubtitle}>
              Merge another phone&apos;s data in, or restore from a backup file
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {pending ? (
        <View style={[styles.card, styles.pendingCard]}>
          <Text style={styles.pendingTitle}>Backup ready to import</Text>
          <Text style={styles.pendingSummary}>
            {pending.summary.profileCount} profile
            {pending.summary.profileCount !== 1 ? 's' : ''},{' '}
            {pending.summary.itemCount} item
            {pending.summary.itemCount !== 1 ? 's' : ''}
            {pending.summary.exportedAt
              ? ` · exported ${new Date(pending.summary.exportedAt).toLocaleDateString()}`
              : ''}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => applyImport('merge')}
          >
            <Text style={styles.primaryButtonText}>Merge into my data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() =>
              confirmDestructive({
                title: 'Replace everything?',
                message:
                  'This deletes ALL data currently on this device and replaces it with the backup.',
                confirmLabel: 'Replace',
                onConfirm: () => {
                  void applyImport('replace');
                },
              })
            }
          >
            <Text style={styles.dangerButtonText}>Replace everything</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setPending(null)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.footerNote}>
        Photos stay on the phone they were taken on — backups carry everything
        else.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
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
  dataLine: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.chipBackground,
    marginVertical: 8,
  },
  pendingCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pendingSummary: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  dangerButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.dislike,
  },
  dangerButtonText: {
    color: colors.dislike,
    fontWeight: '600',
    fontSize: 15,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  footerNote: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  disabled: {
    opacity: 0.5,
  },
});
