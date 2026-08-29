// PlantDetailScreen.tsx
// Screen 5a from the design handoff — the photo timeline as the app's
// retention spine. Real camera capture now exists (see api/photos.ts);
// timeline tiles and the hero box render an actual captured Image when a
// `uri` is present, falling back to the mockup's emoji-tile look when
// they're not (the default demo props still show the mock example content).

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { TabBar, TabKey } from '../components/ui';

export interface PhotoTile {
  day: number;
  icon?: string;
  uri?: string;
}

export interface PlantDetailScreenProps {
  cropName?: string;
  cropIcon?: string;
  dayNumber?: number;
  weekNumber?: number;
  stageLabel?: string;
  /** Overrides the computed "DAY n · WEEK n · STAGE" line — for real crop
   * data, where we only know a coarse planted bucket, not an exact day. */
  metaLine?: string;
  heroDateLabel?: string;
  /** Today's captured photo, if any — shown filling the hero box. */
  heroPhotoUri?: string;
  photoCountLabel?: string;
  timeline?: PhotoTile[];
  instructionTitle?: string;
  instructionDetail?: string;
  stats?: { value: string; label: string }[];
  onBack: () => void;
  onAddPhoto?: () => void;
  onPlayTimeline?: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

const DEFAULT_TIMELINE: PhotoTile[] = [
  { day: 1, icon: '🌱' },
  { day: 24, icon: '🌿' },
  { day: 52, icon: '🪴' },
  { day: 78, icon: '🌼' },
  { day: 111, icon: '🍅' },
];

const DEFAULT_STATS = [
  { value: '27', label: 'lbs picked' },
  { value: '18', label: 'tasks done' },
  { value: '~6', label: 'weeks left' },
];

export default function PlantDetailScreen({
  cropName = 'Tomatoes',
  cropIcon = '🍅',
  dayNumber = 111,
  weekNumber = 11,
  stageLabel = 'FRUITING',
  metaLine,
  heroDateLabel = 'AUG 20 · DAY 111',
  heroPhotoUri,
  photoCountLabel = '31 photos since May 2',
  timeline = DEFAULT_TIMELINE,
  instructionTitle = 'Feed 5-10-10, and pinch suckers if indeterminate',
  instructionDetail = 'High nitrogen now gives leaves, not fruit. On indeterminate varieties, snap out the shoots in each stem-branch V to push energy into the fruit already set. Leave determinate plants alone: pruning costs you yield.',
  stats = DEFAULT_STATS,
  onBack,
  onAddPhoto,
  onPlayTimeline,
  activeTab = 'garden',
  onTabPress,
}: PlantDetailScreenProps) {
  const currentDay = timeline[timeline.length - 1]?.day;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.backCircle}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.cropName}>{cropName}</Text>
            <Text style={styles.cropMeta}>
              {metaLine ?? `DAY ${dayNumber} · WEEK ${weekNumber} · ${stageLabel}`}
            </Text>
          </View>
          <Text style={styles.headerIcon}>{cropIcon}</Text>
        </View>

        <TouchableOpacity style={styles.hero} onPress={onAddPhoto} accessibilityRole="button">
          {heroPhotoUri ? (
            <Image source={{ uri: heroPhotoUri }} style={styles.heroImage} />
          ) : (
            <>
              <Text style={styles.heroIcon}>🌿</Text>
              <Text style={styles.heroTitle}>Today's photo</Text>
              <Text style={styles.heroSub}>Tap to add</Text>
            </>
          )}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{heroDateLabel}</Text>
          </View>
        </TouchableOpacity>

        <View>
          <View style={styles.timelineHeadRow}>
            <Text style={styles.timelineHead}>{photoCountLabel}</Text>
            {timeline.length > 0 ? (
              <TouchableOpacity onPress={onPlayTimeline} accessibilityRole="button">
                <Text style={styles.playLink}>Play ▸</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {timeline.length > 0 ? (
            <View style={styles.timelineRow}>
              {timeline.map((tile) => {
                const isCurrent = tile.day === currentDay;
                return (
                  <View
                    key={tile.day}
                    style={[styles.tile, isCurrent ? styles.tileCurrent : styles.tileOld]}
                  >
                    {tile.uri ? (
                      <Image source={{ uri: tile.uri }} style={styles.tileImage} />
                    ) : (
                      <Text style={[styles.tileIcon, !isCurrent && styles.tileIconDim]}>
                        {tile.icon}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.tileLabel,
                        isCurrent && styles.tileLabelCurrent,
                        tile.uri && styles.tileLabelOnImage,
                      ]}
                    >
                      D{tile.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionEyebrow}>Do this now</Text>
          <Text style={styles.instructionTitle}>{instructionTitle}</Text>
          <Text style={styles.instructionDetail}>{instructionDetail}</Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={onAddPhoto} accessibilityRole="button">
          <Text style={styles.ctaText}>📷 Add today's photo</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  headerText: { flex: 1 },
  cropName: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 22, color: colors.pine },
  cropMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 3,
  },
  headerIcon: { fontSize: 20 },
  hero: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 18,
    height: 186,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  heroIcon: { fontSize: 26, opacity: 0.35 },
  heroTitle: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.inkSoft },
  heroSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft },
  heroBadge: {
    position: 'absolute',
    top: 11,
    left: 12,
    backgroundColor: 'rgba(31,61,43,0.86)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  heroBadgeText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.onPine,
  },
  timelineHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  timelineHead: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  playLink: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.mossGreen },
  timelineRow: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    height: 56,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  tileImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  tileOld: {
    backgroundColor: colors.selectedBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileCurrent: {
    backgroundColor: colors.pine,
    borderWidth: 1,
    borderColor: colors.pine,
  },
  tileIcon: { fontSize: 15 },
  tileIconDim: { opacity: 0.4 },
  tileLabel: { fontFamily: fonts.monoSemiBold, fontSize: 10, color: colors.inkSoft },
  tileLabelCurrent: { color: colors.pineTag },
  tileLabelOnImage: {
    position: 'absolute',
    bottom: 3,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  instructionCard: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 14,
  },
  instructionEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mustard,
    marginBottom: 7,
  },
  instructionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.onPine,
    marginBottom: 4,
  },
  instructionDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.pineFoot,
  },
  statsRow: { flexDirection: 'row', gap: 9 },
  statTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  statValue: { fontFamily: fonts.monoSemiBold, fontSize: 17, color: colors.pine },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 4 },
  cta: {
    backgroundColor: colors.mustard,
    borderRadius: 15,
    padding: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.pine },
});
