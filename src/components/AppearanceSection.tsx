import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  useTheme,
  useThemedStyles,
  type ThemePreference,
} from '../context/ThemeContext';
import type { ThemeColors } from '../theme';

const OPTIONS: { id: ThemePreference; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export function AppearanceSection() {
  const { preference, setPreference, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const selected = preference === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setPreference(option.id)}
            >
              <Ionicons
                name={option.icon}
                size={18}
                color={selected ? colors.onPrimary : colors.textSecondary}
              />
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 10,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    option: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 8,
      paddingVertical: 10,
      backgroundColor: colors.chipBackground,
    },
    optionSelected: {
      backgroundColor: colors.primary,
    },
    optionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    optionTextSelected: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
  });
