import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ProfileChips } from '../components/ProfileChips';
import { SuggestionInput } from '../components/SuggestionInput';
import { useData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import type { Preference } from '../types';
import { confirmDestructive, showAlert } from '../utils/confirm';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

export function AddItemScreen({ route, navigation }: Props) {
  const {
    profiles,
    items,
    categories,
    brands,
    addProfile,
    addItem,
    updateItem,
    removeItem,
  } = useData();

  const itemToEdit = route.params?.itemId
    ? items.find((i) => i.id === route.params?.itemId)
    : undefined;

  const [name, setName] = useState(itemToEdit?.name ?? route.params?.prefillName ?? '');
  const [category, setCategory] = useState(itemToEdit?.category ?? '');
  const [brand, setBrand] = useState(itemToEdit?.brand ?? '');
  const [preference, setPreference] = useState<Preference>(itemToEdit?.preference ?? 'like');
  const [notes, setNotes] = useState(itemToEdit?.notes ?? '');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    itemToEdit?.profileId ?? profiles[0]?.id ?? null,
  );
  const [newProfileName, setNewProfileName] = useState('');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: itemToEdit ? 'Edit Item' : 'Add Item' });
  }, [navigation, itemToEdit]);

  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      return;
    }
    const profile = await addProfile(trimmed);
    setSelectedProfileId(profile.id);
    setNewProfileName('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showAlert('Missing name', 'Please enter an item name.');
      return;
    }
    if (!category.trim()) {
      showAlert('Missing category', 'Please enter a category (e.g. Chicken Wings).');
      return;
    }
    if (!brand.trim()) {
      showAlert('Missing brand', "Please enter a brand (e.g. McDonald's).");
      return;
    }
    if (!selectedProfileId) {
      showAlert('No profile', 'Please pick who this verdict belongs to.');
      return;
    }

    const itemData = {
      name,
      category,
      brand,
      preference,
      notes,
      profileId: selectedProfileId,
    };

    setSaving(true);
    try {
      if (itemToEdit) {
        await updateItem(itemToEdit.id, itemData);
      } else {
        await addItem(itemData);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!itemToEdit) {
      return;
    }
    confirmDestructive({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      onConfirm: () => {
        void removeItem(itemToEdit.id).then(() => navigation.goBack());
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Who tried it?</Text>
      {profiles.length === 0 ? (
        <View style={styles.noProfilesBox}>
          <Text style={styles.noProfilesText}>
            No profiles yet — create one for whoever's verdict this is:
          </Text>
          <View style={styles.inlineCreateRow}>
            <TextInput
              style={styles.inlineCreateInput}
              value={newProfileName}
              onChangeText={setNewProfileName}
              placeholder="Name (e.g. Ryley, Mom, Kids)"
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
              onSubmitEditing={handleCreateProfile}
            />
            <TouchableOpacity
              style={[styles.inlineCreateButton, !newProfileName.trim() && styles.disabledButton]}
              onPress={handleCreateProfile}
              disabled={!newProfileName.trim()}
            >
              <Text style={styles.inlineCreateButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ProfileChips
          profiles={profiles}
          selectedId={selectedProfileId}
          onSelect={setSelectedProfileId}
        />
      )}

      <Text style={styles.label}>Item name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Spicy Chicken Tenders"
        placeholderTextColor={colors.textFaint}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Category</Text>
      <SuggestionInput
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Chicken Tenders"
        suggestions={categories}
      />

      <Text style={styles.label}>Brand</Text>
      <SuggestionInput
        value={brand}
        onChangeText={setBrand}
        placeholder="e.g. McDonald's"
        suggestions={brands}
      />

      <Text style={styles.label}>Verdict</Text>
      <View style={styles.verdictRow}>
        <TouchableOpacity
          style={[styles.verdictButton, preference === 'like' && styles.verdictLikeSelected]}
          onPress={() => setPreference('like')}
        >
          <Ionicons
            name="thumbs-up"
            size={20}
            color={preference === 'like' ? 'white' : colors.like}
          />
          <Text
            style={[styles.verdictText, preference === 'like' && styles.verdictTextSelected]}
          >
            Like
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.verdictButton, preference === 'dislike' && styles.verdictDislikeSelected]}
          onPress={() => setPreference('dislike')}
        >
          <Ionicons
            name="thumbs-down"
            size={20}
            color={preference === 'dislike' ? 'white' : colors.dislike}
          />
          <Text
            style={[styles.verdictText, preference === 'dislike' && styles.verdictTextSelected]}
          >
            Dislike
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Notes — the why</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="e.g. too salty, kids loved it, would buy again"
        placeholderTextColor={colors.textFaint}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <TouchableOpacity
        style={[styles.submitButton, saving && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={saving}
      >
        <Text style={styles.submitButtonText}>
          {itemToEdit ? 'Save Changes' : 'Add Item'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      {itemToEdit && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Item</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noProfilesBox: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noProfilesText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  inlineCreateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineCreateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.text,
  },
  inlineCreateButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inlineCreateButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  verdictRow: {
    flexDirection: 'row',
    gap: 12,
  },
  verdictButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  verdictLikeSelected: {
    backgroundColor: colors.like,
    borderColor: colors.like,
  },
  verdictDislikeSelected: {
    backgroundColor: colors.dislike,
    borderColor: colors.dislike,
  },
  verdictText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  verdictTextSelected: {
    color: 'white',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  deleteButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: colors.dislike,
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
