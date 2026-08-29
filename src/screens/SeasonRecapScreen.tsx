// SeasonRecapScreen.tsx
// Screen 4c from the design handoff — "the screenshot people post." The
// mockup's numbers (41 lbs, 163 days, 86 tasks, a 21-day streak, 31 photos,
// a narrative "best call of the season") are fabricated example content.
// This version only shows what's actually tracked: real harvest totals,
// real completed-task count, and real longest streak (taskEngine.ts). Photo
// count and the "best call" narrative are dropped rather than faked, since
// there's no photo capture or task-causality tracking to back them —
// they're shown only when real data exists to support them (see the
// conditional sections below), the same pattern used everywhere else in
// this rebuild. Share/Save use React Native's built-in Share API for a real
// text summary — there's no image-export pipeline to fake a designed card.

import React from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropLabel } from '../cropMeta';
import { computeLongestStreak } from '../engines/taskEngine';
import { formatWeightLbs, UnitSystem } from '../utils/units';

export interface SeasonRecapScreenProps {
  profile: GardenProfile;
  onClose: () => void;
}

export default function SeasonRecapScreen({ profile, onClose }: SeasonRecapScreenProps) {
  const year = new Date().getFullYear();
  const harvests = profile.harvests ?? [];
  const totalLbs = harvests.reduce((sum, h) => sum + h.weightLbs, 0);
  const units: UnitSystem = profile.units ?? 'imperial';

  const byCrop = new Map<string, number>();
  for (const h of harvests) byCrop.set(h.crop, (byCrop.get(h.crop) ?? 0) + h.weightLbs);
  const topCrops = Array.from(byCrop.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const taskCount = Object.keys(profile.taskCompletions ?? {}).length;
  const longestStreak = computeLongestStreak(profile);

  const daysLogging = harvests.length
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(harvests[0].dateISO).getTime()) / 86400000
        )
      )
    : null;

  const summaryLines = [
    totalLbs > 0 ? `I grew ${formatWeightLbs(totalLbs, units)} of food this year with Sprout.` : null,
    taskCount > 0 ? `${taskCount} garden tasks done, longest streak ${longestStreak} days.` : null,
  ].filter(Boolean);

  async function share() {
    try {
      await Share.share({ message: summaryLines.join(' ') || 'My garden season with Sprout.' });
    } catch {
      // User cancelled the share sheet — nothing to do.
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" style={styles.closeCircle}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.seasonLabel}>{year} season</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardEyebrow}>{profile.location?.label ?? 'Your garden'}</Text>
            <Text style={styles.cardMark}>SPROUT</Text>
          </View>

          <Text style={styles.headline}>
            {totalLbs > 0
              ? `I grew ${formatWeightLbs(totalLbs, units)}\nof food this year`
              : 'My garden,\nthis year'}
          </Text>

          {topCrops.length > 0 ? (
            <View style={styles.statTileRow}>
              {topCrops.map(([crop, lbs]) => (
                <View key={crop} style={styles.statTile}>
                  <Text style={styles.statTileValue}>{formatWeightLbs(lbs, units)}</Text>
                  <Text style={styles.statTileLabel}>{cropLabel(crop).toLowerCase()}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 9 }}>
            {daysLogging ? (
              <View style={styles.numberRow}>
                <Text style={styles.numberValue}>{daysLogging}</Text>
                <Text style={styles.numberLabel}>days from first pick to now</Text>
              </View>
            ) : null}
            {taskCount > 0 ? (
              <View style={styles.numberRow}>
                <Text style={styles.numberValue}>{taskCount}</Text>
                <Text style={styles.numberLabel}>
                  tasks finished{longestStreak > 0 ? `, longest streak ${longestStreak} days` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {totalLbs === 0 && taskCount === 0 ? (
            <Text style={styles.emptyNote}>
              Log a harvest or finish a task to start building this season's recap.
            </Text>
          ) : null}
        </View>

        <Text style={styles.footerNote}>
          Next year starts from these numbers. Sprout already knows what worked.
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareButton} onPress={share} accessibilityRole="button">
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={share} accessibilityRole="button">
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pine },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: fonts.body, fontSize: 15, color: colors.pineFoot },
  seasonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.pineFoot },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 20 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  cardEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mossGreen,
  },
  cardMark: { fontFamily: fonts.monoSemiBold, fontSize: 10, color: colors.inkSoft },
  headline: { fontFamily: fonts.heading, fontSize: 27, lineHeight: 31, color: colors.ink, marginBottom: 16 },
  statTileRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  statTile: { flex: 1, backgroundColor: colors.paper, borderRadius: 15, padding: 13, paddingHorizontal: 12 },
  statTileValue: { fontFamily: fonts.monoSemiBold, fontSize: 20, color: colors.pine },
  statTileLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 3 },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  numberValue: { width: 40, fontFamily: fonts.monoSemiBold, fontSize: 16, color: colors.mossGreen },
  numberLabel: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  emptyNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkSoft,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.pineFoot,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 13,
    marginTop: space.xl,
  },
  actionRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  shareButton: { flex: 1, backgroundColor: colors.mustard, borderRadius: 15, padding: 15, alignItems: 'center' },
  shareButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.pine },
  saveButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  saveButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPine },
});
