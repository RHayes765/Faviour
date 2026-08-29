import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';
import type { Item } from '../types';
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
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onEdit} accessibilityLabel="Edit item">
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete} accessibilityLabel="Delete item">
            <Ionicons name="trash-outline" size={20} color={colors.dislike} />
          </TouchableOpacity>
          <View style={styles.badge}>
            <VerdictBadge preference={item.preference} />
          </View>
        </View>
      </View>
      <Text style={styles.detail}>
        <Text style={styles.label}>Profile: </Text>
        {profileName}
      </Text>
      <Text style={styles.detail}>
        <Text style={styles.label}>Category: </Text>
        {item.category}
      </Text>
      <Text style={styles.detail}>
        <Text style={styles.label}>Brand: </Text>
        {item.brand}
      </Text>
      {item.notes ? (
        <Text style={styles.detail}>
          <Text style={styles.label}>Notes: </Text>
          {item.notes}
        </Text>
      ) : null}
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
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
  },
  badge: {
    marginLeft: 8,
  },
  detail: {
    fontSize: 14,
    marginBottom: 4,
    color: colors.textSecondary,
  },
  label: {
    fontWeight: '500',
  },
});
