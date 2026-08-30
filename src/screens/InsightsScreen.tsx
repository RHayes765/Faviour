import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { ProfileChips } from '../components/ProfileChips';
import { VerdictBadge } from '../components/VerdictBadge';
import { useData } from '../context/DataContext';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useThemedStyles } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import { formatTriedDate } from '../utils/dates';
import { sortByRecency } from '../utils/search';
import {
  brandLikeRatios,
  topCategories,
  topReasonTags,
  verdictTotals,
} from '../utils/stats';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

const EVERYONE = '__everyone__';

export function InsightsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { profiles, items } = useData();
  const [selectedId, setSelectedId] = useState<string>(EVERYONE);

  const chipProfiles = useMemo(
    () => [
      { id: EVERYONE, name: 'Everyone', createdAt: '' },
      ...profiles,
    ],
    [profiles],
  );

  const scoped = useMemo(
    () =>
      selectedId === EVERYONE ? items : items.filter((i) => i.profileId === selectedId),
    [items, selectedId],
  );

  const totals = useMemo(() => verdictTotals(scoped), [scoped]);
  const likedReasons = useMemo(() => topReasonTags(scoped, 'like'), [scoped]);
  const dislikedReasons = useMemo(() => topReasonTags(scoped, 'dislike'), [scoped]);
  const brands = useMemo(() => brandLikeRatios(scoped), [scoped]);
  const categories = useMemo(() => topCategories(scoped), [scoped]);
  const recent = useMemo(() => sortByRecency(scoped).slice(0, 5), [scoped]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Insights</Text>
        <ProfileChips
          profiles={chipProfiles}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {scoped.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="No data yet"
            subtitle="Verdicts show up here once items are added"
          />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.bigNumber}>
                {totals.likeRatio !== null ? Math.round(totals.likeRatio * 100) : 0}%
                <Text style={styles.bigNumberLabel}> liked</Text>
              </Text>
              <View style={styles.ratioBar}>
                <View style={[styles.likesBar, { flex: totals.likes || 0.01 }]} />
                <View style={[styles.dislikesBar, { flex: totals.dislikes || 0.01 }]} />
              </View>
              <Text style={styles.totalsLine}>
                {totals.total} item{totals.total !== 1 ? 's' : ''} · {totals.likes} liked
                · {totals.dislikes} disliked
              </Text>
            </View>

            {likedReasons.length > 0 || dislikedReasons.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>The why</Text>
                {likedReasons.length > 0 ? (
                  <>
                    <Text style={styles.reasonHeading}>Liked because…</Text>
                    <View style={styles.tagWrap}>
                      {likedReasons.map(({ tag, count }) => (
                        <View key={tag} style={[styles.tag, styles.tagLike]}>
                          <Text style={styles.tagText}>
                            {tag} · {count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
                {dislikedReasons.length > 0 ? (
                  <>
                    <Text style={styles.reasonHeading}>Disliked because…</Text>
                    <View style={styles.tagWrap}>
                      {dislikedReasons.map(({ tag, count }) => (
                        <View key={tag} style={[styles.tag, styles.tagDislike]}>
                          <Text style={styles.tagText}>
                            {tag} · {count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {brands.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Brand scoreboard</Text>
                {brands.map((brand) => (
                  <View key={brand.brand.toLowerCase()} style={styles.scoreRow}>
                    <Text style={styles.scoreName} numberOfLines={1}>
                      {brand.brand}
                    </Text>
                    <Text style={styles.scoreDetail}>
                      {Math.round(brand.ratio * 100)}% · {brand.likes}/{brand.total}
                    </Text>
                  </View>
                ))}
                <Text style={styles.cardFootnote}>Brands with at least 2 items</Text>
              </View>
            ) : null}

            {categories.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Most logged categories</Text>
                {categories.map(({ category, count }) => (
                  <View key={category.toLowerCase()} style={styles.scoreRow}>
                    <Text style={styles.scoreName} numberOfLines={1}>
                      {category}
                    </Text>
                    <Text style={styles.scoreDetail}>{count}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {recent.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recently tried</Text>
                {recent.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentRow}
                    onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                  >
                    <VerdictBadge preference={item.preference} />
                    <Text style={styles.recentName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.recentDate}>{formatTriedDate(item.updatedAt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  bigNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
  },
  bigNumberLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  ratioBar: {
    height: 6,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    backgroundColor: colors.chipBackground,
  },
  likesBar: {
    backgroundColor: colors.like,
  },
  dislikesBar: {
    backgroundColor: colors.dislike,
  },
  totalsLine: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  reasonHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 6,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  tag: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagLike: {
    backgroundColor: colors.likeSoft,
  },
  tagDislike: {
    backgroundColor: colors.dislikeSoft,
  },
  tagText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scoreName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  scoreDetail: {
    fontSize: 14,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cardFootnote: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  recentName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  recentDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
