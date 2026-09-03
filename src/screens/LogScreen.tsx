// LogScreen.tsx
// Screen 5b from the design handoff — free to write, Pro to remember
// (year-over-year comparison is a Pro feature per the README's Free/Pro
// table). Fully real: every number comes from profile.harvests, which
// starts empty for a new garden, so the empty state is a real first-class
// case, not the mockup's fabricated "41 lbs" example season.
//
// compareToLastSeason is real too, gated behind profile.isPro (see
// PaywallScreen.tsx for what that flag actually is — a local preview, not
// a real subscription check). It needs harvests logged in two different
// calendar years to say anything, which a fresh install won't have — that
// empty state is handled explicitly rather than showing a blank card.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { GardenProfile, HarvestEntry } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropIconBg, cropLabel } from '../cropMeta';
import { formatWeightLbs, UnitSystem } from '../utils/units';
import { CropIcon, TabBar, TabKey } from '../components/ui';

const SPLIT_COLORS = [colors.mustard, colors.pineTag, colors.sevFyiBg, colors.selectedBg];

interface SeasonCompare {
  totalLbsThisYear: number;
  totalLbsLastYear: number;
  cropSentence: string | null;
}

function dayOfYear(dateISO: string): number {
  const d = new Date(dateISO);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function firstPickDayOfYear(list: HarvestEntry[], crop: CropKey): number | null {
  const forCrop = list
    .filter((h) => h.crop === crop)
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
  return forCrop.length > 0 ? dayOfYear(forCrop[0].dateISO) : null;
}

/** Compares this calendar year's harvests to last year's. Returns null if
 * there's nothing logged from last year to compare against yet. */
function compareToLastSeason(harvests: HarvestEntry[], now: Date): SeasonCompare | null {
  const thisYear = now.getFullYear();
  const thisYearHarvests = harvests.filter((h) => new Date(h.dateISO).getFullYear() === thisYear);
  const lastYearHarvests = harvests.filter((h) => new Date(h.dateISO).getFullYear() === thisYear - 1);
  if (lastYearHarvests.length === 0) return null;

  const totalLbsThisYear = thisYearHarvests.reduce((s, h) => s + h.weightLbs, 0);
  const totalLbsLastYear = lastYearHarvests.reduce((s, h) => s + h.weightLbs, 0);

  let cropSentence: string | null = null;
  let biggestShiftDays = 0;
  for (const crop of new Set(thisYearHarvests.map((h) => h.crop))) {
    const thisDay = firstPickDayOfYear(thisYearHarvests, crop);
    const lastDay = firstPickDayOfYear(lastYearHarvests, crop);
    if (thisDay == null || lastDay == null) continue;
    const diffDays = lastDay - thisDay; // positive = came earlier this year
    if (Math.abs(diffDays) > Math.abs(biggestShiftDays)) {
      biggestShiftDays = diffDays;
      const dir = diffDays > 0 ? 'earlier' : 'later';
      const n = Math.abs(diffDays);
      cropSentence = `Your first ${cropLabel(crop).toLowerCase()} came ${n} day${n === 1 ? '' : 's'} ${dir} than last year.`;
    }
  }

  return { totalLbsThisYear, totalLbsLastYear, cropSentence };
}

export interface LogScreenProps {
  profile: GardenProfile;
  onAddHarvest: () => void;
  onOpenPaywall: () => void;
  onOpenRecap: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function LogScreen({
  profile,
  onAddHarvest,
  onOpenPaywall,
  onOpenRecap,
  activeTab = 'log',
  onTabPress,
}: LogScreenProps) {
  const harvests = profile.harvests ?? [];
  const totalLbs = harvests.reduce((sum, h) => sum + h.weightLbs, 0);
  const units: UnitSystem = profile.units ?? 'imperial';

  const byCrop = new Map<CropKey, number>();
  for (const h of harvests) byCrop.set(h.crop, (byCrop.get(h.crop) ?? 0) + h.weightLbs);
  const cropTotals = Array.from(byCrop.entries()).sort((a, b) => b[1] - a[1]);

  const recent = [...harvests].sort(
    (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
  );
  const year = new Date().getFullYear();
  const compare = profile.isPro ? compareToLastSeason(harvests, new Date()) : null;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{year} season</Text>
            <Text style={styles.title}>Harvest log</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={onAddHarvest} accessibilityRole="button">
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryNumber}>{formatWeightLbs(totalLbs, units)}</Text>
            <Text style={styles.summaryUnit}>picked so far</Text>
          </View>
          {totalLbs > 0 ? (
            <>
              <View style={styles.splitBar}>
                {cropTotals.map(([crop, lbs], i) => (
                  <View
                    key={crop}
                    style={{
                      width: `${(lbs / totalLbs) * 100}%`,
                      backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length],
                    }}
                  />
                ))}
              </View>
              <View style={styles.legendRow}>
                {cropTotals.map(([crop, lbs], i) => (
                  <View key={crop} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {cropLabel(crop)} {formatWeightLbs(lbs, units)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {totalLbs > 0 ? (
          <TouchableOpacity style={styles.recapRow} onPress={onOpenRecap} accessibilityRole="button">
            <Text style={styles.recapIcon}>🎉</Text>
            <Text style={styles.recapText}>See your season recap</Text>
            <Text style={styles.recapChevron}>›</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionLabel}>Recent picks</Text>

        {recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nothing logged yet. Tap + to record your first pick, even a couple leaves count.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            {recent.map((h) => (
              <View key={h.id} style={styles.pickRow}>
                <View style={[styles.pickIconWrap, { backgroundColor: cropIconBg(h.crop) }]}>
                  <CropIcon crop={h.crop} size={15} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickTitle}>{h.note || cropLabel(h.crop)}</Text>
                  <Text style={styles.pickSub}>
                    {new Date(h.dateISO).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    {formatWeightLbs(h.weightLbs, units)}
                  </Text>
                </View>
                <Text style={styles.pickDate}>
                  {new Date(h.dateISO)
                    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    .toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!profile.isPro ? (
          <TouchableOpacity style={styles.compareCard} onPress={onOpenPaywall} accessibilityRole="button">
            <View style={styles.compareHeadRow}>
              <Text style={styles.compareIcon}>📚</Text>
              <Text style={styles.compareTitle}>Compare to last season</Text>
              <Text style={styles.proTag}>PRO</Text>
            </View>
            <Text style={styles.compareBody}>
              Once Sprout has a full season logged, Pro can tell you how this year compares:
              "your first tomato came 12 days earlier than last year."
            </Text>
          </TouchableOpacity>
        ) : compare ? (
          <View style={[styles.compareCard, styles.compareCardUnlocked]}>
            <View style={styles.compareHeadRow}>
              <Text style={styles.compareIcon}>📚</Text>
              <Text style={styles.compareTitle}>Compare to last season</Text>
              <Text style={styles.includedTag}>✓ Pro</Text>
            </View>
            <Text style={styles.compareBody}>
              {formatWeightLbs(compare.totalLbsThisYear, units)} picked so far this year, vs{' '}
              {formatWeightLbs(compare.totalLbsLastYear, units)} by this point last year.
              {compare.cropSentence ? ` ${compare.cropSentence}` : ''}
            </Text>
          </View>
        ) : (
          <View style={[styles.compareCard, styles.compareCardUnlocked]}>
            <View style={styles.compareHeadRow}>
              <Text style={styles.compareIcon}>📚</Text>
              <Text style={styles.compareTitle}>Compare to last season</Text>
              <Text style={styles.includedTag}>✓ Pro</Text>
            </View>
            <Text style={styles.compareBody}>
              Nothing to compare yet, this needs a harvest logged in a previous year. Check back
              once you've made it through a second season.
            </Text>
          </View>
        )}
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: 11,
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.pine },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPine },
  summaryCard: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 17,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 13 },
  summaryNumber: { fontFamily: fonts.monoSemiBold, fontSize: 34, lineHeight: 34, color: colors.onPine },
  summaryUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.pineFoot },
  splitBar: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 9,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.pineFoot },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 14,
  },
  recapIcon: { fontSize: 15 },
  recapText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  recapChevron: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
  },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 11,
    paddingHorizontal: 14,
  },
  pickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickIconText: { fontSize: 15 },
  pickTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  pickSub: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  pickDate: { fontFamily: fonts.monoSemiBold, fontSize: 11, color: colors.inkSoft },
  compareCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    padding: 13,
    marginTop: 4,
  },
  compareCardUnlocked: { borderStyle: 'solid', borderColor: colors.mossGreen },
  includedTag: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.mossGreen,
  },
  compareHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  compareIcon: { fontSize: 14 },
  compareTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  proTag: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
  },
  compareBody: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft },
});
