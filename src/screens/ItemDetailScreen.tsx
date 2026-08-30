import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { VerdictBadge } from '../components/VerdictBadge';
import { useData } from '../context/DataContext';
import { useSync } from '../context/SyncContext';
import type { RootStackParamList } from '../navigation/types';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { profileColor } from '../theme';
import type { ThemeColors } from '../theme';
import { formatTriedDate } from '../utils/dates';
import { confirmDestructive } from '../utils/confirm';
import { photoUri } from '../utils/photos';
import { rankInfo } from '../utils/ranking';
// rankInfo is used for both own and shared cohorts; shared items never render
// photos (photoFileName is nulled at pull time) or edit affordances.

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route, navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { items, profiles, removeItem } = useData();
  const { sharedItems, sharedProfiles, sharedLabelFor } = useSync();
  const ownItem = items.find((i) => i.id === route.params.itemId);
  const item = ownItem ?? sharedItems.find((i) => i.id === route.params.itemId);
  const isShared = !ownItem && Boolean(item);
  const profile = item
    ? (profiles.find((p) => p.id === item.profileId) ??
      sharedProfiles.find((p) => p.id === item.profileId))
    : undefined;
  const sharedLabel = item && isShared ? sharedLabelFor(item.profileId) : null;

  useLayoutEffect(() => {
    navigation.setOptions({ title: item?.name ?? 'Item' });
  }, [navigation, item?.name]);

  if (!item) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="help-circle-outline"
          title="Item not found"
          subtitle="It may have been deleted"
          buttonLabel="Go back"
          onButtonPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const handleDelete = () => {
    confirmDestructive({
      title: 'Delete Item',
      message: `Delete ${item.name}? This can't be undone.`,
      onConfirm: () => {
        void removeItem(item.id).then(() => navigation.goBack());
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.verdictRow}>
        <VerdictBadge preference={item.preference} size="large" />
        <Text style={styles.triedDate}>Tried {formatTriedDate(item.updatedAt)}</Text>
      </View>

      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.brandLine}>
        {item.brand} · {item.category}
      </Text>

      {photoUri(item.photoFileName) ? (
        <Image source={{ uri: photoUri(item.photoFileName)! }} style={styles.photo} />
      ) : null}

      {profile ? (
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: profileColor(profile.name) }]}>
            <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>
            {profile.name}&apos;s verdict
            {isShared ? ` · shared${sharedLabel ? ` by ${sharedLabel}` : ''}` : ''}
          </Text>
        </View>
      ) : null}

      {isShared && item.rankInCategory !== null ? (
        <View style={[styles.rankRow, styles.rankRowStatic]}>
          <Ionicons name="trophy-outline" size={18} color={colors.textMuted} />
          <Text style={styles.rankRowText}>
            {(() => {
              const info = rankInfo(sharedItems, item);
              return info
                ? `Their #${info.position} of ${info.total} in ${item.category}`
                : `Ranked in ${item.category}`;
            })()}
          </Text>
        </View>
      ) : null}

      {!isShared && item.category.trim() ? (
        <TouchableOpacity
          style={styles.rankRow}
          onPress={() =>
            navigation.navigate('CategoryRank', {
              category: item.category,
              profileId: item.profileId,
            })
          }
        >
          <Ionicons name="trophy-outline" size={18} color={colors.primary} />
          <Text style={styles.rankRowText}>
            {(() => {
              const info = rankInfo(items, item);
              return info
                ? `#${info.position} of ${info.total} in ${item.category} · Edit ranking`
                : `Rank in ${item.category}`;
            })()}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}

      {item.reasonTags.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Why</Text>
          <View style={styles.tagRow}>
            {item.reasonTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {item.notes ? (
        <>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.notes}>{item.notes}</Text>
        </>
      ) : null}

      {item.barcode ? (
        <>
          <Text style={styles.sectionLabel}>Barcode</Text>
          <View style={styles.barcodeRow}>
            <Ionicons name="barcode-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.barcodeText}>{item.barcode}</Text>
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>History</Text>
      <Text style={styles.historyText}>
        Added {formatTriedDate(item.createdAt)}
        {item.updatedAt !== item.createdAt
          ? ` · Updated ${formatTriedDate(item.updatedAt)}`
          : ''}
      </Text>

      {!isShared ? (
        <>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('AddItem', { itemId: item.id })}
          >
            <Ionicons name="pencil" size={18} color={colors.onPrimary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Item</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.sharedFootnote}>
          This is from a shared list — only its owner can edit it.
        </Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triedDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
  },
  brandLine: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginTop: 16,
    backgroundColor: colors.chipBackground,
    resizeMode: 'cover',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  rankRowText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  rankRowStatic: {
    opacity: 0.85,
  },
  sharedFootnote: {
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: colors.chipBackground,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  notes: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  historyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 32,
  },
  editButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: colors.dislike,
    fontSize: 15,
    fontWeight: '500',
  },
});
