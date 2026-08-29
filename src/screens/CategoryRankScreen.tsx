import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { ProfileChips } from '../components/ProfileChips';
import { RankList } from '../components/RankList';
import { VerdictBadge } from '../components/VerdictBadge';
import { useData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { categoryRanking } from '../utils/ranking';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryRank'>;

export function CategoryRankScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const { profiles, items, setCategoryRanks } = useData();
  const [profileId, setProfileId] = useState<string | null>(
    route.params.profileId ?? profiles[0]?.id ?? null,
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Rank: ${category}` });
  }, [navigation, category]);

  if (!profileId) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="people-outline"
          title="No profiles yet"
          subtitle="Create a profile before ranking"
          buttonLabel="Go back"
          onButtonPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const { ranked, unranked } = categoryRanking(items, profileId, category);
  const rankedIds = ranked.map((i) => i.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Whose ranking?</Text>
      <ProfileChips profiles={profiles} selectedId={profileId} onSelect={setProfileId} />

      <Text style={styles.sectionLabel}>
        {ranked.length > 0 ? 'Best to worst — drag or use the arrows' : 'Nothing ranked yet'}
      </Text>
      {ranked.length > 0 ? (
        <RankList
          items={ranked}
          onReorder={(ids) => {
            void setCategoryRanks(profileId, category, ids);
          }}
          onRemove={(id) => {
            void setCategoryRanks(
              profileId,
              category,
              rankedIds.filter((rankedId) => rankedId !== id),
            );
          }}
        />
      ) : (
        <Text style={styles.hint}>
          Pull items in from the list below to build the ladder.
        </Text>
      )}

      {unranked.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Not ranked yet</Text>
          {unranked.map((item) => (
            <View key={item.id} style={styles.unrankedRow}>
              <VerdictBadge preference={item.preference} />
              <View style={styles.unrankedInfo}>
                <Text style={styles.unrankedName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.unrankedBrand} numberOfLines={1}>
                  {item.brand}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  void setCategoryRanks(profileId, category, [...rankedIds, item.id]);
                }}
              >
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addButtonText}>Rank it</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}

      {ranked.length === 0 && unranked.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={`Nothing in ${category} yet`}
          subtitle="Items this person has tried in this category will show up here"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  unrankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  unrankedInfo: {
    flex: 1,
  },
  unrankedName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  unrankedBrand: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});
