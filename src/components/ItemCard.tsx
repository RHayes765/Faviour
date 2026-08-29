import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';
import type { Item } from '../types';
import { formatTriedDate } from '../utils/dates';
import { photoUri } from '../utils/photos';
import { VerdictBadge } from './VerdictBadge';

interface Props {
  item: Item;
  profileName: string;
  onPress: () => void;
}

export function ItemCard({ item, profileName, onPress }: Props) {
  const liked = item.preference === 'like';
  const photo = photoUri(item.photoFileName);
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: liked ? colors.like : colors.dislike }]}
      onPress={onPress}
      accessibilityLabel={`View ${item.name}`}
    >
      <View style={styles.header}>
        <VerdictBadge preference={item.preference} size="large" />
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

const styles = StyleSheet.create({
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
