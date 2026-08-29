import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { lookupBarcode, type ProductInfo } from '../api/openFoodFacts';
import { ProfileChips } from '../components/ProfileChips';
import { SuggestionInput } from '../components/SuggestionInput';
import { TagPicker } from '../components/TagPicker';
import { useData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import type { Preference } from '../types';
import { normalizeBarcode } from '../utils/barcode';
import { confirmDestructive, showAlert } from '../utils/confirm';
import { deletePhoto, importPhoto, photoUri } from '../utils/photos';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

export function AddItemScreen({ route, navigation }: Props) {
  const {
    profiles,
    items,
    categories,
    brands,
    reasonTags,
    addProfile,
    addItem,
    updateItem,
    removeItem,
    addReasonTag,
  } = useData();

  const itemToEdit = route.params?.itemId
    ? items.find((i) => i.id === route.params?.itemId)
    : undefined;

  const [name, setName] = useState(itemToEdit?.name ?? route.params?.prefillName ?? '');
  const [category, setCategory] = useState(itemToEdit?.category ?? '');
  const [brand, setBrand] = useState(itemToEdit?.brand ?? '');
  const [preference, setPreference] = useState<Preference>(itemToEdit?.preference ?? 'like');
  const [notes, setNotes] = useState(itemToEdit?.notes ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    itemToEdit?.reasonTags ?? [],
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    itemToEdit?.profileId ?? profiles[0]?.id ?? null,
  );
  const [barcode, setBarcode] = useState<string | null>(
    itemToEdit?.barcode ??
      (route.params?.prefillBarcode
        ? normalizeBarcode(route.params.prefillBarcode)
        : null),
  );
  const [newProfileName, setNewProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  // Newly picked photo (cache URI, imported on save) and removal of an existing one.
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const displayedPhotoUri =
    pickedPhotoUri ?? (photoRemoved ? null : photoUri(itemToEdit?.photoFileName ?? null));

  useLayoutEffect(() => {
    navigation.setOptions({ title: itemToEdit ? 'Edit Item' : 'Add Item' });
  }, [navigation, itemToEdit]);

  // Barcode handed back by ScanScreen in capture mode.
  useEffect(() => {
    const scanned = route.params?.scannedBarcode;
    if (scanned) {
      setBarcode(normalizeBarcode(scanned));
      navigation.setParams({ scannedBarcode: undefined });
    }
  }, [route.params?.scannedBarcode, navigation]);

  // Best-effort Open Food Facts lookup for new items with a barcode; offers a
  // one-tap prefill and never blocks the flow.
  const [suggestion, setSuggestion] = useState<ProductInfo | null>(null);
  useEffect(() => {
    if (!barcode || itemToEdit) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    void lookupBarcode(barcode).then((info) => {
      if (!cancelled) {
        setSuggestion(info);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode]);

  const applySuggestion = () => {
    if (!suggestion) {
      return;
    }
    if (suggestion.name && !name.trim()) {
      setName(suggestion.name);
    }
    if (suggestion.brand && !brand.trim()) {
      setBrand(suggestion.brand);
    }
    setSuggestion(null);
  };

  const [creatingProfile, setCreatingProfile] = useState(false);
  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed || creatingProfile) {
      return;
    }
    setCreatingProfile(true);
    try {
      const profile = await addProfile(trimmed);
      setSelectedProfileId(profile.id);
      setNewProfileName('');
    } finally {
      setCreatingProfile(false);
    }
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

    setSaving(true);
    let importedPhoto: string | null = null;
    try {
      let photoFileName = itemToEdit?.photoFileName ?? null;
      if (pickedPhotoUri) {
        importedPhoto = await importPhoto(pickedPhotoUri);
        photoFileName = importedPhoto;
      } else if (photoRemoved) {
        photoFileName = null;
      }

      const itemData = {
        name,
        category,
        brand,
        preference,
        reasonTags: selectedTags,
        notes,
        barcode,
        photoFileName,
        profileId: selectedProfileId,
      };

      if (itemToEdit) {
        await updateItem(itemToEdit.id, itemData);
      } else {
        await addItem(itemData);
      }
      // Only after the record is persisted is it safe to drop a replaced or
      // removed old photo file.
      if ((importedPhoto || photoRemoved) && itemToEdit?.photoFileName) {
        deletePhoto(itemToEdit.photoFileName);
      }
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save item', e);
      deletePhoto(importedPhoto);
      showAlert('Save failed', "The item couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Camera access needed', 'Allow camera access to take a product photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedPhotoUri(result.assets[0].uri);
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
        // Pop past the detail screen too — it has nothing to show anymore.
        void removeItem(itemToEdit.id).then(() => navigation.popTo('Main'));
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
              style={[
                styles.inlineCreateButton,
                (!newProfileName.trim() || creatingProfile) && styles.disabledButton,
              ]}
              onPress={handleCreateProfile}
              disabled={!newProfileName.trim() || creatingProfile}
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

      <Text style={styles.label}>Why? Tap what applies</Text>
      <TagPicker
        availableTags={reasonTags}
        selectedTags={selectedTags}
        onToggleTag={(tag) =>
          setSelectedTags((prev) =>
            prev.some((t) => t.toLowerCase() === tag.toLowerCase())
              ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
              : [...prev, tag],
          )
        }
        onCreateTag={addReasonTag}
      />

      <Text style={styles.label}>Barcode</Text>
      {barcode ? (
        <View style={styles.barcodeRow}>
          <Ionicons name="barcode-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.barcodeText}>{barcode}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Scan', { mode: 'capture' })}
            accessibilityLabel="Rescan barcode"
            style={styles.barcodeAction}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBarcode(null)}
            accessibilityLabel="Remove barcode"
            style={styles.barcodeAction}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Scan', { mode: 'capture' })}
        >
          <Ionicons name="barcode-outline" size={20} color={colors.primary} />
          <Text style={styles.scanButtonText}>Scan barcode</Text>
        </TouchableOpacity>
      )}

      {suggestion && (suggestion.name || suggestion.brand) ? (
        <View style={styles.suggestionBanner}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={styles.suggestionText} numberOfLines={1}>
            {[suggestion.name, suggestion.brand].filter(Boolean).join(' · ')}
          </Text>
          <TouchableOpacity style={styles.suggestionUse} onPress={applySuggestion}>
            <Text style={styles.suggestionUseText}>Use</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSuggestion(null)}
            accessibilityLabel="Dismiss suggestion"
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.label}>Photo</Text>
      {displayedPhotoUri ? (
        <View style={styles.photoPreviewBox}>
          <Image source={{ uri: displayedPhotoUri }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={takePhoto}
              accessibilityLabel="Retake photo"
            >
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={() => {
                setPickedPhotoUri(null);
                setPhotoRemoved(true);
              }}
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="trash-outline" size={20} color={colors.dislike} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.photoButtonRow}>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={styles.photoButtonText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={20} color={colors.primary} />
            <Text style={styles.photoButtonText}>Choose photo</Text>
          </TouchableOpacity>
        </View>
      )}

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
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.card,
    gap: 8,
  },
  barcodeText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  barcodeAction: {
    padding: 2,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
  photoPreviewBox: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 8,
  },
  photoActionButton: {
    padding: 6,
  },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EAF3FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  suggestionUse: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionUseText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
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
