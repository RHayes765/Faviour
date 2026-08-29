import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { Preference } from '../types';

interface Props {
  preference: Preference;
  /** 'small' = icon-only pill for cards; 'large' = labeled verdict for lookup/detail. */
  size?: 'small' | 'large';
}

export function VerdictBadge({ preference, size = 'small' }: Props) {
  const liked = preference === 'like';
  const background = liked ? colors.like : colors.dislike;
  const icon = liked ? 'thumbs-up' : 'thumbs-down';

  if (size === 'small') {
    return (
      <View style={[styles.small, { backgroundColor: background }]}>
        <Ionicons name={icon} size={13} color="white" />
      </View>
    );
  }
  return (
    <View style={[styles.large, { backgroundColor: background }]}>
      <Ionicons name={icon} size={18} color="white" />
      <Text style={styles.largeLabel}>{liked ? 'Liked it' : 'Not a fan'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  small: {
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  largeLabel: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
