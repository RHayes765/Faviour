import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';
import type { Item } from '../types';
import { formatTriedDate } from '../utils/dates';
import { VerdictBadge } from './VerdictBadge';

interface Props {
  item: Item;
  profileName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemCard({ item, profileName, onEdit, onDelete }: Props) {
  const liked = item.preference === 'like';
  return (
    <View style={[styles.card, { borderLeftColor: liked ? colors.like : colors.dislike }]}>
      <View style={styles.header}>
        <VerdictBadge preference={item.preference} size="large" />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onEdit} accessibilityLabel="Edit item">
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete} accessibilityLabel="Delete item">
            <Ionicons name="trash-outline" size={20} color={colors.dislike} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.detail}>
        {item.brand} · {item.category}
      </Text>
      <Text style={styles.meta}>
        {profileName} · Tried {formatTriedDate(item.updatedAt)}
      </Text>
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
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
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  notes: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
