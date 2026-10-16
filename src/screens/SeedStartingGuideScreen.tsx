// SeedStartingGuideScreen.tsx
// "Seed starting 101" — the how-to behind the start-indoors and
// harden-off tasks (see taskEngine.ts's Seed starting section). Written for
// someone who has never started a seed: what to buy, then five short steps.
// The *when* lives in the tasks themselves, per crop, so nothing here is
// dated.
//
// Buy links are plain Amazon searches for now, same as feed tasks'
// placeholder links (see taskEngine.ts's placeholderFertilizerBuyUrl).
// Once there's an Amazon Associates account, add the tag in amazonSearch()
// and an affiliate disclosure line under the list.

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

function amazonSearch(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

const SUPPLIES = [
  {
    icon: '🪴',
    title: 'Seed-starting mix',
    why: 'Light and fine, so tiny roots can push through. Not garden soil or regular potting soil.',
    query: 'seed starting mix',
  },
  {
    icon: '🧊',
    title: 'Seed tray with a clear lid',
    why: 'Cells keep each seedling separate; the lid holds in moisture until they sprout.',
    query: 'seed starting tray with humidity dome',
  },
  {
    icon: '🔥',
    title: 'Heat mat',
    why: 'Gentle warmth from below. Most seeds sprout days sooner, peppers especially.',
    query: 'seedling heat mat',
  },
  {
    icon: '💡',
    title: 'Grow light',
    why: "A sunny window isn't bright enough. Without one, seedlings stretch tall and flop.",
    query: 'LED grow light for seedlings',
  },
  {
    icon: '⏲️',
    title: 'Plug-in timer',
    why: 'Runs the light 14 to 16 hours a day so you never have to remember.',
    query: 'outlet timer',
  },
];

const STEPS = [
  {
    title: 'Sow',
    body:
      'Dampen the mix first, then fill the cells. Sow 2 to 3 seeds per cell, about twice as deep as the seed is wide. Tiny seeds like lettuce just get pressed onto the surface. Label every row, they all look the same once they sprout.',
  },
  {
    title: 'Heat, then light',
    body:
      'Lid on, tray on the heat mat. As soon as most seeds have sprouted: lid off, heat mat off, grow light on. Keep the light 2 to 3 inches above the leaves and raise it as they grow.',
  },
  {
    title: 'Water from below',
    body:
      "Pour water into the tray, let the mix soak it up for 20 minutes, then pour off the rest. Moist, never soggy. Once seedlings have their second set of leaves, snip all but the strongest one in each cell.",
  },
  {
    title: 'Harden off (the step everyone skips)',
    body:
      "Indoor seedlings get shocked by real sun and wind. About a week before transplanting, set them outside a little longer each day: an hour or two in shade at first, then half a day with some morning sun, then most of the day. Bring them in if frost or strong wind is forecast. GardenWise tells you when to start.",
  },
  {
    title: 'Transplant',
    body:
      'Pick a cloudy day or the evening, so they settle in out of hot sun. Plant at the same depth they sat in their cells, then water well.',
  },
];

export interface SeedStartingGuideScreenProps {
  onBack: () => void;
  backLabel?: string;
}

export default function SeedStartingGuideScreen({ onBack, backLabel = 'Back' }: SeedStartingGuideScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button">
        <Text style={styles.back}>‹ {backLabel}</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Seed starting 101</Text>
      <Text style={styles.title}>Start seeds indoors</Text>
      <Text style={styles.intro}>
        Starting indoors gives slow growers like peppers and tomatoes a head start of weeks before it's warm enough
        outside. GardenWise gives you the date for each crop. Here's the how.
      </Text>

      <Text style={styles.sectionLabel}>What you need</Text>
      <View style={styles.card}>
        {SUPPLIES.map((s, i) => (
          <View key={s.title} style={[styles.supplyRow, i > 0 && styles.supplyRowBorder]}>
            <Text style={styles.supplyIcon}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplyTitle}>{s.title}</Text>
              <Text style={styles.supplyWhy}>{s.why}</Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(amazonSearch(s.query))}
              style={styles.buyPill}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${s.title} on Amazon`}
            >
              <Text style={styles.buyText}>Buy</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>How to do it</Text>
      <View style={{ gap: space.sm }}>
        {STEPS.map((step, i) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>
        Rather buy seedlings? That's completely fine. Open the crop in My Garden and skip its indoor steps.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl },
  back: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: space.md },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 29, color: colors.pine, marginBottom: space.sm },
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingHorizontal: 14,
  },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  supplyRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  supplyIcon: { fontSize: 20 },
  supplyTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  supplyWhy: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  buyPill: {
    borderWidth: 1.5,
    borderColor: colors.clay,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  buyText: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.clay },
  stepCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 14,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.onPine },
  stepTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 4 },
  stepBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: space.xl,
  },
});
