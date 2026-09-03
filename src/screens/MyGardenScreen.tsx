// MyGardenScreen.tsx
// Screen 3a from the design handoff — "the tab that had no screen." One card
// per selected crop, linking into the plant detail / photo timeline (5a).
//
// The design shows exact sown/end calendar dates and a precise "Week 11"
// label. The current data model only tracks a coarse planted bucket (just
// planted / 2-4wk / 4-8wk / 8+wk), not an exact sown date, so those labels
// are adapted to what we actually know rather than inventing precision the
// app doesn't have. Season-bar proportions (sow/grow/harvest split) and the
// harvest-log preview are static per crop until a real task/harvest data
// model exists — same placeholder approach as 5a's stats.

import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { PlantedBucket } from '../engines/alertsEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropIconBg, cropLabel } from '../cropMeta';
import { BUCKET_LABEL, NEXT_ACTION, NEXT_ACTION_ICON, SEASON_SHAPE, STAGE_HEADLINE } from '../plantStageContent';
import { plantingGuidanceFor } from '../engines/plantingGuide';
import { formatBedSize, formatWeightLbs, UnitSystem } from '../utils/units';
import { CropIcon, TabBar, TabKey } from '../components/ui';

const FREE_CROPS: CropKey[] = ['tomatoes', 'cucumbers', 'lettuce', 'carrots'];
const PRO_CROPS: CropKey[] = [
  'peppers',
  'basil',
  'potatoes',
  'garlic',
  'strawberries',
  'squash',
  'corn',
  'onions',
  'broccoli',
  'cauliflower',
  'cabbage',
  'kale',
  'spinach',
  'chard',
  'beets',
  'radishes',
  'turnips',
  'peas',
  'beans',
  'zucchini',
  'pumpkin',
  'eggplant',
  'celery',
  'asparagus',
  'brusselssprouts',
  'leeks',
  'okra',
  'sweetpotatoes',
  'rutabaga',
  'kohlrabi',
  'arugula',
  'collards',
  'bokchoy',
  'cilantro',
  'parsley',
  'mint',
  'rosemary',
  'thyme',
  'oregano',
  'dill',
  'chives',
  'sage',
  'watermelon',
  'cantaloupe',
  'blueberries',
  'raspberries',
];

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export interface MyGardenScreenProps {
  profile: GardenProfile;
  onOpenCrop: (crop: CropKey) => void;
  onAddCrop: () => void;
  onOpenLog: () => void;
  onRemoveCrop: (crop: CropKey) => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function MyGardenScreen({
  profile,
  onOpenCrop,
  onAddCrop,
  onOpenLog,
  onRemoveCrop,
  activeTab = 'garden',
  onTabPress,
}: MyGardenScreenProps) {
  function confirmRemoveCrop(crop: CropKey) {
    Alert.alert(
      `Remove ${cropLabel(crop)}?`,
      "It'll come off My Garden and stop generating tasks. Photos and harvest history for it stay in your log.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveCrop(crop) },
      ]
    );
  }

  const totalLbs = (profile.harvests ?? []).reduce((sum, h) => sum + h.weightLbs, 0);
  const crops = profile.crops.filter((c): c is CropKey => c !== 'other');
  const availableCrops = profile.isPro ? [...FREE_CROPS, ...PRO_CROPS] : FREE_CROPS;
  const missingCrops = availableCrops.filter((c) => !profile.crops.includes(c));
  const units: UnitSystem = profile.units ?? 'imperial';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>
              Garden · {formatBedSize(profile.bedWidthFt, profile.bedLengthFt, units)}
            </Text>
            <Text style={styles.title}>My Garden</Text>
          </View>
          <Text style={styles.cropCount}>{crops.length} of {availableCrops.length} crops</Text>
        </View>

        {crops.map((crop) => {
          const bucket = (profile.plantedWeeks[crop] ?? 'w2') as PlantedBucket;
          const notPlanted = bucket === 'w0';
          const guidance = notPlanted ? plantingGuidanceFor(crop, profile.frostDates) : null;
          const shape = SEASON_SHAPE[crop];
          const stage = notPlanted ? guidance!.headline : STAGE_HEADLINE[crop]?.[bucket] ?? '';
          const next = notPlanted ? guidance!.detail : NEXT_ACTION[crop]?.[bucket] ?? '';

          return (
            <TouchableOpacity
              key={crop}
              style={styles.cropCard}
              onPress={() => onOpenCrop(crop)}
              accessibilityRole="button"
            >
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => confirmRemoveCrop(crop)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${cropLabel(crop)}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>

              <View style={styles.cropHeadRow}>
                <View style={[styles.cropIconWrap, { backgroundColor: cropIconBg(crop) }]}>
                  <CropIcon crop={crop} size={20} />
                </View>
                <View style={styles.cropHeadText}>
                  <Text style={styles.cropName}>{cropLabel(crop)}</Text>
                  <Text style={styles.cropStage}>{stage}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              {shape && !notPlanted ? (
                <View>
                  <View style={styles.seasonTrack}>
                    <View
                      style={[styles.seasonSeg, styles.seasonSow, { width: `${shape.sow}%` }]}
                    />
                    <View
                      style={[
                        styles.seasonSeg,
                        styles.seasonGrow,
                        { left: `${shape.sow}%`, width: `${shape.grow}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.seasonSeg,
                        styles.seasonHarvest,
                        { left: `${shape.sow + shape.grow}%`, width: `${shape.harvest}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.seasonLabels}>
                    <Text style={styles.seasonLabel}>PLANTED {BUCKET_LABEL[bucket].toUpperCase()}</Text>
                    <Text style={styles.seasonLabel}>~{shape.weeks} WK SEASON</Text>
                  </View>
                </View>
              ) : null}

              {next ? (
                <View style={styles.nextStrip}>
                  <Text style={styles.nextIcon}>{notPlanted ? '🌱' : NEXT_ACTION_ICON[crop] ?? '🌱'}</Text>
                  <Text style={styles.nextText}>
                    <Text style={styles.nextBold}>{notPlanted ? 'Plan: ' : 'Next: '}</Text>
                    {next}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {missingCrops.length > 0 ? (
          <TouchableOpacity style={styles.addCard} onPress={onAddCrop} accessibilityRole="button">
            <View style={styles.addIconWrap}>
              <Text style={styles.addIconText}>+</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTitle}>Add a crop</Text>
              <Text style={styles.addSub}>
                {profile.isPro
                  ? `${missingCrops.length} more available`
                  : `${missingCrops.length} free ${missingCrops.length === 1 ? 'slot' : 'slots'} left: ${joinNames(
                      missingCrops.map(cropLabel).map((l) => l.toLowerCase())
                    )}`}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logRow} onPress={onOpenLog} accessibilityRole="button">
          <View style={styles.logIconWrap}>
            <Text style={styles.logIconText}>🧺</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logTitle}>Harvest log</Text>
            <Text style={styles.logSub}>
              {totalLbs > 0 ? `${formatWeightLbs(totalLbs, units)} picked this season` : 'Nothing logged yet'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
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
  cropCount: { fontFamily: fonts.monoSemiBold, fontSize: 11, color: colors.inkSoft },
  cropCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
    gap: 11,
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  removeButtonText: { fontSize: 11, color: colors.inkSoft, fontFamily: fonts.bodyBold },
  cropHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cropIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropIconText: { fontSize: 20 },
  cropHeadText: { flex: 1, minWidth: 0 },
  cropName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  cropStage: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  seasonTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.seasonTrack,
    position: 'relative',
    overflow: 'hidden',
  },
  seasonSeg: { position: 'absolute', top: 0, bottom: 0 },
  seasonSow: { left: 0, backgroundColor: colors.mossGreen, opacity: 0.4 },
  seasonGrow: { backgroundColor: colors.mossGreen },
  seasonHarvest: { backgroundColor: colors.mustard },
  seasonLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  seasonLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkSoft },
  nextStrip: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: 11,
  },
  nextIcon: { fontSize: 13 },
  nextText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.ink },
  nextBold: { fontFamily: fonts.bodyBold },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: 15,
    padding: 13,
  },
  addIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.selectedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.mossGreen },
  addTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  addSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 12,
    marginBottom: 4,
  },
  logIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.sevFyiBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logIconText: { fontSize: 15 },
  logTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  logSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
});
