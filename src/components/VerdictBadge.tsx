import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import type { Preference } from '../types';

interface Props {
  preference: Preference;
  /** 'small' = icon-only pill for cards; 'large' = labeled verdict for lookup/detail. */
  size?: 'small' | 'large';
}

export function VerdictBadge({ preference, size = 'small' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const liked = preference === 'like';
  const background = liked ? colors.like : colors.dislike;
  const icon = liked ? 'thumbs-up' : 'thumbs-down';

  if (size === 'small') {
    return (
      <View style={[styles.small, { backgroundColor: background }]}>
        <Ionicons name={icon} size={13} color={colors.onPrimary} />
      </View>
    );
  }
  return (
    <View style={[styles.large, { backgroundColor: background }]}>
      <Ionicons name={icon} size={18} color={colors.onPrimary} />
      <Text style={styles.largeLabel}>{liked ? 'Liked it' : 'Not a fan'}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
