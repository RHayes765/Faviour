import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { ItemCard } from '../components/ItemCard';
import { useData } from '../context/DataContext';
import { useSync } from '../context/SyncContext';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useThemedStyles, useThemeColors } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import type { Preference } from '../types';
import { rankInfo } from '../utils/ranking';
import { ALL_FILTER, filterItems, sortByRecency } from '../utils/search';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Lookup'>,
  NativeStackScreenProps<RootStackParamList>
>;

const ALL = ALL_FILTER;

export function ItemsScreen({ route, navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { profiles, items, categories, brands } = useData();
  const { sharedItems, sharedProfiles, sharedLabelFor } = useSync();
  const sharedItemIds = useMemo(
    () => new Set(sharedItems.map((i) => i.id)),
    [sharedItems],
  );
  const allItems = useMemo(() => [...items, ...sharedItems], [items, sharedItems]);
  const [selectedProfile, setSelectedProfile] = useState<string>(ALL);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [selectedBrand, setSelectedBrand] = useState<string>(ALL);
  const [selectedPreference, setSelectedPreference] = useState<Preference | typeof ALL>(ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Applies the profile filter passed from ProfilesScreen's "View Items".
  useEffect(() => {
    const profileFilterId = route.params?.profileFilterId;
    if (profileFilterId) {
      setSelectedProfile(profileFilterId);
      setShowFilters(true);
      navigation.setParams({ profileFilterId: undefined });
    }
  }, [route.params?.profileFilterId, navigation]);

  // Drop a profile filter whose profile has been deleted — otherwise the list
  // sticks on "Profile: Unknown" with no way to see anything.
  useEffect(() => {
    if (selectedProfile !== ALL && !profiles.some((p) => p.id === selectedProfile)) {
      setSelectedProfile(ALL);
    }
  }, [profiles, selectedProfile]);

  const filteredItems = useMemo(
    () =>
      sortByRecency(
        filterItems(allItems, {
          query: searchQuery,
          profileId: selectedProfile,
          category: selectedCategory,
          brand: selectedBrand,
          preference: selectedPreference,
        }),
      ),
    [allItems, searchQuery, selectedProfile, selectedCategory, selectedBrand, selectedPreference],
  );

  const activeFiltersCount = [
    selectedProfile !== ALL,
    selectedCategory !== ALL,
    selectedBrand !== ALL,
    selectedPreference !== ALL,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedProfile(ALL);
    setSelectedCategory(ALL);
    setSelectedBrand(ALL);
    setSelectedPreference(ALL);
    setSearchQuery('');
  };

  const profileName = (profileId: string) => {
    const own = profiles.find((p) => p.id === profileId);
    if (own) {
      return own.name;
    }
    const sharedProfile = sharedProfiles.find((p) => p.id === profileId);
    if (sharedProfile) {
      const label = sharedLabelFor(profileId);
      return label ? `${sharedProfile.name} · ${label}` : sharedProfile.name;
    }
    return 'Unknown';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={colors.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => navigation.navigate('Scan', {})}
          accessibilityLabel="Scan barcode"
        >
          <Ionicons name="barcode-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
          accessibilityLabel="Toggle filters"
        >
          <Ionicons
            name="options-outline"
            size={24}
            color={activeFiltersCount > 0 ? colors.primary : colors.textMuted}
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilters}>
            {selectedProfile !== ALL && (
              <FilterChip
                label={`Profile: ${profileName(selectedProfile)}`}
                onRemove={() => setSelectedProfile(ALL)}
              />
            )}
            {selectedCategory !== ALL && (
              <FilterChip label={`Category: ${selectedCategory}`} onRemove={() => setSelectedCategory(ALL)} />
            )}
            {selectedBrand !== ALL && (
              <FilterChip label={`Brand: ${selectedBrand}`} onRemove={() => setSelectedBrand(ALL)} />
            )}
            {selectedPreference !== ALL && (
              <FilterChip
                label={`Verdict: ${selectedPreference === 'like' ? 'Liked' : 'Disliked'}`}
                onRemove={() => setSelectedPreference(ALL)}
              />
            )}
            {(activeFiltersCount > 0 || searchQuery !== '') && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Profile</Text>
            <Picker
              selectedValue={selectedProfile}
              onValueChange={(value) => setSelectedProfile(value)}
              style={styles.picker}
            >
              <Picker.Item label="All Profiles" value={ALL} />
              {profiles.map((profile) => (
                <Picker.Item key={profile.id} label={profile.name} value={profile.id} />
              ))}
              {sharedProfiles.map((profile) => (
                <Picker.Item
                  key={profile.id}
                  label={`${profile.name} (shared)`}
                  value={profile.id}
                />
              ))}
            </Picker>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category</Text>
            <Picker
              selectedValue={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value)}
              style={styles.picker}
            >
              <Picker.Item label="All Categories" value={ALL} />
              {categories.map((cat) => (
                <Picker.Item key={cat} label={cat} value={cat} />
              ))}
            </Picker>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Brand</Text>
            <Picker
              selectedValue={selectedBrand}
              onValueChange={(value) => setSelectedBrand(value)}
              style={styles.picker}
            >
              <Picker.Item label="All Brands" value={ALL} />
              {brands.map((brand) => (
                <Picker.Item key={brand} label={brand} value={brand} />
              ))}
            </Picker>
          </View>

          {selectedCategory !== ALL ? (
            <TouchableOpacity
              style={styles.rankCategoryButton}
              onPress={() =>
                navigation.navigate('CategoryRank', {
                  category: selectedCategory,
                  profileId: selectedProfile !== ALL ? selectedProfile : undefined,
                })
              }
            >
              <Ionicons name="trophy-outline" size={16} color={colors.primary} />
              <Text style={styles.rankCategoryText}>Rank this category</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Verdict</Text>
            <Picker
              selectedValue={selectedPreference}
              onValueChange={(value) => setSelectedPreference(value)}
              style={styles.picker}
            >
              <Picker.Item label="All" value={ALL} />
              <Picker.Item label="Liked" value="like" />
              <Picker.Item label="Disliked" value="dislike" />
            </Picker>
          </View>
        </View>
      )}

      {filteredItems.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon="fast-food-outline"
            image={require('../../assets/splash-icon.png')}
            title="Nothing tracked yet"
            subtitle="Add the first product you want to remember"
            buttonLabel="Add an item"
            onButtonPress={() => navigation.navigate('AddItem', {})}
          />
        ) : searchQuery.trim() && activeFiltersCount === 0 ? (
          <EmptyState
            icon="search-outline"
            title={`Nothing for “${searchQuery.trim()}”`}
            subtitle="Looks like it hasn't been tried yet"
            buttonLabel="Add it"
            onButtonPress={() =>
              navigation.navigate('AddItem', { prefillName: searchQuery.trim() })
            }
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="No items match"
            buttonLabel="Clear filters"
            onButtonPress={clearFilters}
          />
        )
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const shared = sharedItemIds.has(item.id);
            return (
              <ItemCard
                item={item}
                profileName={profileName(item.profileId)}
                rankBadge={rankInfo(shared ? sharedItems : items, item)}
                shared={shared}
                onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              />
            );
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddItem', {})}
        accessibilityLabel="Add item"
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  return (
    <View style={styles.filterChip}>
      <Text style={styles.filterChipText}>{label}</Text>
      <TouchableOpacity onPress={onRemove} accessibilityLabel={`Remove filter ${label}`}>
        <Ionicons name="close" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  filterButton: {
    padding: 8,
    marginLeft: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  activeFilters: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 4,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  clearButton: {
    backgroundColor: colors.chipBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: colors.dislike,
    fontSize: 12,
    fontWeight: '500',
  },
  filterGroup: {
    marginBottom: 12,
  },
  rankCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    marginBottom: 12,
  },
  rankCategoryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: colors.text,
  },
  picker: {
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  listContent: {
    paddingBottom: 96,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.2)',
  },
});
