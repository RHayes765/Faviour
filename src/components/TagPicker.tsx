import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors } from '../theme';

interface Props {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  /** Persists a new tag and returns the canonical tag list. */
  onCreateTag: (tag: string) => Promise<string[]>;
}

export function TagPicker({ availableTags, selectedTags, onToggleTag, onCreateTag }: Props) {
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState('');

  const isSelected = (tag: string) =>
    selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());

  const handleCreate = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) {
      return;
    }
    const tags = await onCreateTag(trimmed);
    const canonical =
      tags.find((t) => t.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    if (!isSelected(canonical)) {
      onToggleTag(canonical);
    }
    setNewTag('');
    setCreating(false);
  };

  return (
    <View>
      <View style={styles.wrap}>
        {availableTags.map((tag) => {
          const selected = isSelected(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onToggleTag(tag)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
        {!creating ? (
          <TouchableOpacity style={[styles.chip, styles.newChip]} onPress={() => setCreating(true)}>
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={styles.newChipText}>New tag</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newTag}
            onChangeText={setNewTag}
            placeholder="e.g. Too greasy"
            placeholderTextColor={colors.textFaint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[styles.createButton, !newTag.trim() && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!newTag.trim()}
          >
            <Text style={styles.createButtonText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createCancel}
            onPress={() => {
              setCreating(false);
              setNewTag('');
            }}
            accessibilityLabel="Cancel new tag"
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.chipBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  newChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 2,
  },
  newChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.card,
    color: colors.text,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  createCancel: {
    padding: 4,
  },
});
