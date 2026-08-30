import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useThemedStyles, useThemeColors } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import type { Item } from '../types';
import { formatTriedDate } from '../utils/dates';
import { photoUri } from '../utils/photos';
import { VerdictBadge } from './VerdictBadge';

interface Props {
  item: Item;
  profileName: string;
  onPress: () => void;
  /** Dense ladder position, computed by the parent via rankInfo(). */
  rankBadge?: { position: number; total: number } | null;
  /** True for items from another account's shared profile (read-only). */
  shared?: boolean;
}

export function ItemCard({ item, profileName, onPress, rankBadge, shared }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const liked = item.preference === 'like';
  const photo = photoUri(item.photoFileName);
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: liked ? colors.like : colors.dislike }]}
      onPress={onPress}
      accessibilityLabel={`View ${item.name}`}
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <VerdictBadge preference={item.preference} size="large" />
          {rankBadge ? (
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>#{rankBadge.position}</Text>
            </View>
          ) : null}
          {shared ? (
            <View style={styles.sharedPill}>
              <Text style={styles.sharedPillText}>Shared</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta}>
          {profileName} · {formatTriedDate(item.updatedAt)}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.bodyText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.detail}>
            {item.brand} · {item.category}
          </Text>
        </View>
        {photo ? <Image source={{ uri: photo }} style={styles.thumbnail} /> : null}
      </View>
      {item.reasonTags.length > 0 ? (
        <View style={styles.tagRow}>
          {item.reasonTags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {item.reasonTags.length > 3 ? (
            <Text style={styles.tagMore}>+{item.reasonTags.length - 3}</Text>
          ) : null}
        </View>
      ) : null}
      {item.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankPill: {
    backgroundColor: colors.rankPillBg,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rankPillText: {
    color: colors.rankPillText,
    fontSize: 12,
    fontWeight: '700',
  },
  sharedPill: {
    backgroundColor: colors.chipBackground,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sharedPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bodyText: {
    flex: 1,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.chipBackground,
  },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  detail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  notes: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: colors.chipBackground,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagMore: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
