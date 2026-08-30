import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useThemedStyles } from '../context/ThemeContext';
import { profileColor } from '../theme';
import type { ThemeColors } from '../theme';
import type { Profile } from '../types';

interface Props {
  profiles: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProfileChips({ profiles, selectedId, onSelect }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {profiles.map((profile) => {
        const selected = profile.id === selectedId;
        return (
          <TouchableOpacity
            key={profile.id}
            style={[
              styles.chip,
              selected && { backgroundColor: profileColor(profile.name) },
            ]}
            onPress={() => onSelect(profile.id)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {profile.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: colors.chipBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
