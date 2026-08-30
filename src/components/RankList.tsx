import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Sortable from 'react-native-sortables';

import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import type { Item } from '../types';
import { VerdictBadge } from './VerdictBadge';

interface Props {
  /** Ranked items in ladder order. */
  items: Item[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (id: string) => void;
}

/**
 * The reorderable ladder. Drag-and-drop (react-native-sortables) on native;
 * every row also has up/down chevrons — the accessibility path, the web-dev-
 * surface path, and the fallback if the drag library misbehaves (in which
 * case set DRAG_ENABLED to false and everything still works).
 */
const DRAG_ENABLED = Platform.OS !== 'web';

export function RankList({ items, onReorder, onRemove }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) {
      return;
    }
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  };

  const renderRow = (item: Item, index: number) => (
    <View style={styles.row}>
      {DRAG_ENABLED ? (
        <Ionicons name="reorder-three-outline" size={22} color={colors.textFaint} />
      ) : null}
      <Text style={styles.position}>#{index + 1}</Text>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.brand} numberOfLines={1}>
          {item.brand}
        </Text>
      </View>
      <VerdictBadge preference={item.preference} />
      <View style={styles.chevrons}>
        <TouchableOpacity
          onPress={() => move(index, -1)}
          disabled={index === 0}
          style={[styles.chevron, index === 0 && styles.chevronDisabled]}
          accessibilityLabel={`Move ${item.name} up`}
        >
          <Ionicons name="chevron-up" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => move(index, 1)}
          disabled={index === items.length - 1}
          style={[styles.chevron, index === items.length - 1 && styles.chevronDisabled]}
          accessibilityLabel={`Move ${item.name} down`}
        >
          <Ionicons name="chevron-down" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.remove}
        accessibilityLabel={`Remove ${item.name} from ranking`}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  if (!DRAG_ENABLED) {
    return (
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={item.id}>{renderRow(item, index)}</View>
        ))}
      </View>
    );
  }

  return (
    <Sortable.Grid
      columns={1}
      data={items}
      keyExtractor={(item) => item.id}
      rowGap={8}
      onDragEnd={({ data }) => onReorder(data.map((i) => i.id))}
      renderItem={({ item }) => renderRow(item, items.findIndex((i) => i.id === item.id))}
    />
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  position: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 34,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  brand: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chevrons: {
    flexDirection: 'row',
  },
  chevron: {
    padding: 4,
  },
  chevronDisabled: {
    opacity: 0.3,
  },
  remove: {
    padding: 4,
    marginLeft: 2,
  },
});
