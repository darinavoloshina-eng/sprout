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
//
// Selecting and configuring a crop used to be two disconnected steps: tap
// it in the grid, then scroll down to a separate "when did you plant
// these?" section to find that same crop again and set its stage — easy to
// lose track of once more than a couple crops were selected. A selected
// crop's card now expands in place (still inside the same wrapping grid,
// it just claims the full row instead of a half-width tile) to show its
// planted-stage picker immediately, right where it was tapped.
//
// Free used to mean four specific named crops (tomatoes, cucumbers,
// lettuce, carrots) and nothing else was even visible. It's a count now,
// not a list: every crop in every category is browsable for free, and the
// FREE_CROP_LIMIT'th + 1 pick is what actually opens the paywall (see
// atFreeLimit/toggleCrop below). FREE_CROPS/PRO_CROPS below just seed the
// combined catalog at this point — they no longer gate visibility.

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { PlantedBackdate } from '../engines/alertsEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { CROP_CATEGORY, CropCategory, cropLabel, FREE_CROP_LIMIT, isOfferedCategory, isOfferedCrop, plantedBucketsFor } from '../cropMeta';
import { saveProfile } from '../api/storage';
import { assumedPlantedDateForBucket, effectiveBackdate, effectiveBucket, markPlanted } from '../engines/taskEngine';
import { CropIcon, TabBar, TabKey } from '../components/ui';
import { SuggestionsList } from '../components/Suggestions';
import { suggestCrops } from '../engines/suggestions';

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
  'blackberries',
  'grapes',
  'rhubarb',
  'figs',
  'marigold',
  'zinnia',
  'sunflower',
  'cosmos',
  'nasturtium',
  'pansy',
  'dahlias',
  'lemon',
  'lime',
  'orange',
  'kumquat',
  'olive',
  'avocado',
  'pomegranate',
  'peach',
  'cherry',
  'apple',
  'pear',
  'plum',
  'greenonions',
  'tomatillos',
];



export interface EditCropsScreenProps {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onBack: () => void;
  onOpenPaywall: () => void;
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
  /** Unused since the picker became one A–Z list; kept so callers compile. */
  initialCategory?: CropCategory;
}

export default function EditCropsScreen({
  profile,
  onProfileChange,
  onBack,
  onOpenPaywall,
  activeTab,
  onTabPress,
  initialCategory,
}: EditCropsScreenProps) {
  function updateProfile(patch: Partial<GardenProfile>) {
    const updated: GardenProfile = { ...profile, ...patch };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  const selectedCount = profile.crops.filter((c) => c !== 'other').length;
  const atFreeLimit = !profile.isPro && selectedCount >= FREE_CROP_LIMIT;

  // `bucket`: suggestions add crops as not-planted-yet; a tap in the
  // catalog keeps assuming it's already in the ground.
  function toggleCrop(c: CropKey, bucket: PlantedBackdate = 'w2') {
    if (profile.crops.includes(c)) {
      const { [c]: _removed, ...plantedWeeks } = profile.plantedWeeks;
      updateProfile({ crops: profile.crops.filter((x) => x !== c), plantedWeeks });
      return;
    }
    // Free is a count, not a fixed list — picking a 5th crop from
    // anywhere in the catalog is what actually needs Pro, so this is
    // where that gate lives now instead of on category visibility.
    if (atFreeLimit) {
      onOpenPaywall();
      return;
    }
    updateProfile({
      crops: [...profile.crops, c],
      plantedWeeks: { ...profile.plantedWeeks, [c]: bucket },
    });
  }

  function setPlantedWeek(c: CropKey, bucket: PlantedBackdate) {
    // A manual backdate pill is a deliberate correction, so it always wins
    // over whatever exact date was tracked before — but rather than
    // clearing that date outright, it's replaced with a fresh best-guess
    // for the new bucket (see assumedPlantedDateForBucket) so succession
    // and feed reminders still have something to anchor to.
    const assumedDate = assumedPlantedDateForBucket(bucket);
    const plantedDates = { ...profile.plantedDates };
    if (assumedDate) plantedDates[c] = assumedDate;
    else delete plantedDates[c];
    updateProfile({ plantedWeeks: { ...profile.plantedWeeks, [c]: bucket }, plantedDates });
  }

  function handleMarkPlanted(c: CropKey) {
    const updated = markPlanted(profile, c);
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }


  const [showSuggestions, setShowSuggestions] = useState(false);
  // Computed once per open, so a crop doesn't vanish from the list the
  // moment it's added (it shows as "✓ Added" instead).
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestCrops>>(null);
  function toggleSuggestions() {
    if (!showSuggestions) setSuggestions(suggestCrops(profile.frostDates, profile.crops));
    setShowSuggestions((v) => !v);
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

  // Everyone browses the full catalog now — free is a cap on how many
  // crops total, not which specific ones are visible. See atFreeLimit
  // above for where that cap actually bites.
  const visibleCrops = [...FREE_CROPS, ...PRO_CROPS]
    .filter((c) => isOfferedCrop(c, profile.crops))
    .sort((a, b) => cropLabel(a).localeCompare(cropLabel(b)));

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.topRow}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crops</Text>
        <Text style={styles.sub}>Tap a crop to add it, then set when you planted it.</Text>
        {!profile.isPro ? (
          <Text style={styles.freeCountText}>
            {selectedCount} of {FREE_CROP_LIMIT} free crops selected
          </Text>
        ) : null}

        <TouchableOpacity style={styles.suggestToggle} onPress={toggleSuggestions} accessibilityRole="button">
          <Text style={styles.suggestIcon}>{showSuggestions ? '‹' : '🌱'}</Text>
          <Text style={styles.suggestLabel}>
            {showSuggestions ? 'See all crops' : 'Not sure? See what grows well near you right now'}
          </Text>
          {showSuggestions ? null : <Text style={styles.categoryDropdownChevron}>›</Text>}
        </TouchableOpacity>
        {showSuggestions ? (
          <View style={styles.suggestPanel}>
            {suggestions ? (
              <SuggestionsList
                suggestions={suggestions}
                isAdded={(c) => profile.crops.includes(c)}
                onToggle={(c) => toggleCrop(c, 'w0')}
              />
            ) : (
              <Text style={styles.sub}>
                {profile.location
                  ? 'Still looking up the frost history for your location. Try again in a moment.'
                  : 'Add your location in Settings to see what grows well where you live.'}
              </Text>
            )}
          </View>
        ) : null}

        <View style={[styles.cropGrid, showSuggestions && styles.hidden]}>
          {visibleCrops.map((c) => {
            const selected = profile.crops.includes(c);

            if (!selected) {
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.cropCard, atFreeLimit && styles.cropCardLocked]}
                  onPress={() => toggleCrop(c)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false, disabled: atFreeLimit }}
                >
                  <CropIcon crop={c} size={23} />
                  <Text style={styles.cropLabel}>
                    {cropLabel(c)}
                    {atFreeLimit ? ' 🔒' : ''}
                  </Text>
                </TouchableOpacity>
              );
            }

            return (
              <View key={c} style={styles.cropCardExpanded}>
                <TouchableOpacity
                  style={styles.cropCardExpandedHeader}
                  onPress={() => toggleCrop(c)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                >
                  <CropIcon crop={c} size={22} />
                  <Text style={styles.cropLabelExpanded}>{cropLabel(c)}</Text>
                  <View style={styles.cropCheck}>
                    <Text style={styles.cropCheckText}>✓</Text>
                  </View>
                </TouchableOpacity>

                <Text style={styles.bucketPrompt}>When did you plant it?</Text>
                <View style={styles.pillRow}>
                  {plantedBucketsFor(c).map((b) => {
                    const sel = effectiveBackdate(profile, c) === b.key;
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

                {effectiveBucket(profile, c) === 'w0' ? (
                  <TouchableOpacity
                    style={styles.markPlantedButton}
                    onPress={() => handleMarkPlanted(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${cropLabel(c)} as planted today`}
                  >
                    <Text style={styles.markPlantedButtonText}>Just planted it? ✓ Mark as planted today</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {!profile.isPro ? (
          <TouchableOpacity style={styles.proBanner} onPress={onOpenPaywall} accessibilityRole="button">
            <View style={styles.proBannerIconWrap}>
              <Text style={styles.proBannerIcon}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proBannerTitle}>Grow more than {FREE_CROP_LIMIT} crops</Text>
              <Text style={styles.proBannerSub}>Plus grow-more tips and year-over-year · $2.99/mo</Text>
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
  // The suggestions view replaces the full catalog until "See all crops".
  hidden: { display: 'none' },
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
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginTop: 4, marginBottom: 8 },
  suggestToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.selectedBg,
    borderWidth: 1.5,
    borderColor: colors.mossGreen,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  suggestIcon: { fontSize: 18 },
  suggestLabel: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, lineHeight: 18, color: colors.pine },
  suggestPanel: { marginBottom: space.lg },
  freeCountText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: colors.mossGreen,
    marginBottom: 16,
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  categoryDropdownIcon: { fontSize: 15 },
  categoryDropdownLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  categoryDropdownChevron: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  categoryMenu: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    marginTop: -4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  categoryMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  categoryMenuItemSelected: { backgroundColor: colors.selectedBg },
  categoryMenuItemLast: { borderBottomWidth: 0 },
  categoryMenuIcon: { fontSize: 16 },
  categoryMenuLabel: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  categoryMenuLabelSelected: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.mossGreen },
  categoryMenuCheck: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.mossGreen },
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
  },
  cropCardLocked: { opacity: 0.55 },
  cropLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  cropCardExpanded: {
    width: '100%',
    backgroundColor: colors.selectedBg,
    borderWidth: 1.5,
    borderColor: colors.mossGreen,
    borderRadius: 15,
    padding: 13,
    gap: 10,
  },
  cropCardExpandedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cropLabelExpanded: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  cropCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.mossGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropCheckText: { color: colors.onPine, fontFamily: fonts.bodyBold, fontSize: 11 },
  bucketPrompt: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.inkSoft,
  },
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
  markPlantedButton: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.mossGreen,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  markPlantedButtonText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.mossGreen },
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
