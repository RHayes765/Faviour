import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useThemedStyles, useThemeColors } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Existing values to suggest as tappable chips while typing. */
  suggestions: string[];
  maxSuggestions?: number;
}

/**
 * TextInput with a row of tappable suggestion chips underneath — a simpler,
 * overlay-free replacement for the legacy dropdown autocomplete.
 */
export function SuggestionInput({
  value,
  onChangeText,
  placeholder,
  suggestions,
  maxSuggestions = 6,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const trimmed = value.trim().toLowerCase();
  const matches = suggestions
    .filter((s) => s.toLowerCase().includes(trimmed))
    .filter((s) => s.toLowerCase() !== trimmed)
    .slice(0, maxSuggestions);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
      />
      {matches.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestionRow}
        >
          {matches.map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              style={styles.suggestionChip}
              onPress={() => onChangeText(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  suggestionChip: {
    backgroundColor: colors.chipBackground,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
