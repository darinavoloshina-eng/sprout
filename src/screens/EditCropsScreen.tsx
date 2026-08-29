// EditCropsScreen.tsx
// Lightweight add/remove-crop editor reached from My Garden's "+ Add a
// crop" card and Settings' "Crops" row. Deliberately NOT the onboarding
// wizard: no location/space/save/email steps and no wizard chrome, and the
// tab bar stays visible throughout since this is a quick edit to an
// existing garden, not first-run setup. Every toggle already autosaves
// immediately (same pattern as My Garden's remove-crop and Settings'
// watering fields) — the Save button below doesn't do any extra writing,
// it's a confirmation step so the user sees their picks actually stuck
// before leaving, then takes them back where they came from.

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { PlantedBucket } from '../engines/alertsEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { CROP_META, cropLabel } from '../cropMeta';
import { saveProfile } from '../api/storage';
import { TabBar, TabKey } from '../components/ui';

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

const BUCKETS: { key: PlantedBucket; label: string }[] = [
  { key: 'w0', label: 'Not planted' },
  { key: 'w2', label: '1–4 wks' },
  { key: 'w4', label: '4–8 wks' },
  { key: 'w8', label: '8+ wks' },
];

export interface EditCropsScreenProps {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onBack: () => void;
  onOpenPaywall: () => void;
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function EditCropsScreen({
  profile,
  onProfileChange,
  onBack,
  onOpenPaywall,
  activeTab,
  onTabPress,
}: EditCropsScreenProps) {
  function updateProfile(patch: Partial<GardenProfile>) {
    const updated: GardenProfile = { ...profile, ...patch };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  function toggleCrop(c: CropKey) {
    if (profile.crops.includes(c)) {
      const { [c]: _removed, ...plantedWeeks } = profile.plantedWeeks;
      updateProfile({ crops: profile.crops.filter((x) => x !== c), plantedWeeks });
    } else {
      updateProfile({
        crops: [...profile.crops, c],
        plantedWeeks: { ...profile.plantedWeeks, [c]: 'w2' },
      });
    }
  }

  function setPlantedWeek(c: CropKey, bucket: PlantedBucket) {
    updateProfile({ plantedWeeks: { ...profile.plantedWeeks, [c]: bucket } });
  }

  const [justSaved, setJustSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function handleSavePress() {
    setJustSaved(true);
    saveTimer.current = setTimeout(onBack, 700);
  }

  const cropList = profile.crops.filter((c): c is CropKey => c !== 'other');

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.topRow}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crops</Text>
        <Text style={styles.sub}>Tap to add or remove, then save when you're done.</Text>

        <View style={styles.cropGrid}>
          {(profile.isPro ? [...FREE_CROPS, ...PRO_CROPS] : FREE_CROPS).map((c) => {
            const selected = profile.crops.includes(c);
            return (
              <TouchableOpacity
                key={c}
                style={[styles.cropCard, selected && styles.cropCardSelected]}
                onPress={() => toggleCrop(c)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                {selected ? (
                  <View style={styles.cropCheck}>
                    <Text style={styles.cropCheckText}>✓</Text>
                  </View>
                ) : null}
                <Text style={styles.cropIcon}>{CROP_META[c].icon}</Text>
                <Text style={styles.cropLabel}>{CROP_META[c].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {cropList.length > 0 ? (
          <View style={styles.plantedSection}>
            <Text style={styles.sectionLabel}>When did you plant these?</Text>
            {cropList.map((c) => (
              <View key={c} style={styles.plantedBlock}>
                <Text style={styles.plantedName}>{cropLabel(c)}</Text>
                <View style={styles.pillRow}>
                  {BUCKETS.map((b) => {
                    const sel = (profile.plantedWeeks[c] ?? 'w2') === b.key;
                    return (
                      <TouchableOpacity
                        key={b.key}
                        style={[styles.pill, sel && styles.pillSelected]}
                        onPress={() => setPlantedWeek(c, b.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sel }}
                      >
                        <Text style={sel ? styles.pillTextSelected : styles.pillText}>{b.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!profile.isPro ? (
          <TouchableOpacity style={styles.proBanner} onPress={onOpenPaywall} accessibilityRole="button">
            <View style={styles.proBannerIconWrap}>
              <Text style={styles.proBannerIcon}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proBannerTitle}>Unlock all crops</Text>
              <Text style={styles.proBannerSub}>Peppers, basil, potatoes, garlic and more · $3/mo</Text>
            </View>
            <View style={styles.proBannerCta}>
              <Text style={styles.proBannerCtaText}>Try free</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, justSaved && styles.saveButtonSaved]}
          onPress={handleSavePress}
          disabled={justSaved}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>{justSaved ? 'Saved ✓' : 'Save'}</Text>
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
  },
  topRow: { minHeight: 20, marginBottom: space.xs, justifyContent: 'center', alignSelf: 'flex-start' },
  back: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.pine, marginTop: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginTop: 4, marginBottom: 16 },
  cropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cropCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 7,
    position: 'relative',
  },
  cropCardSelected: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  cropCheck: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.mossGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropCheckText: { color: colors.onPine, fontFamily: fonts.bodyBold, fontSize: 10 },
  cropIcon: { fontSize: 23 },
  cropLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  plantedSection: { marginTop: 13 },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 9,
    marginTop: 13,
  },
  plantedBlock: { marginBottom: space.sm },
  plantedName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginBottom: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  pillSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  pillTextSelected: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.onPine },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.pine,
    borderRadius: 15,
    padding: 14,
    marginTop: 20,
  },
  proBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(217,166,46,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBannerIcon: { fontSize: 16 },
  proBannerTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPine },
  proBannerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pineFoot, marginTop: 2 },
  proBannerCta: { backgroundColor: colors.mustard, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 12 },
  proBannerCtaText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.pine },
  saveButton: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonSaved: { backgroundColor: colors.mossGreen },
  saveButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
});
