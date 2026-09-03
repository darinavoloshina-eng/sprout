// OnboardingScreen.tsx
// Screens 2a-2d + 5c from the design handoff — the setup flow, rebuilt to
// match the new visual language after the rest of the app moved to it.
//
// Two deliberate departures from the mockup, both functional necessities:
//  - Watering method (drip/hand + emitter math) isn't asked here, per the
//    README ("do not reinstate it") — but scheduleEngine still needs it to
//    compute a watering task, so new gardens default to drip / 12" / 12" /
//    0.5 GPH. Editable later would need a Settings row that doesn't exist
//    yet.
//  - "When did you plant" stays folded into the crop step. It's not in the
//    mockup, but it's what alertsEngine and the whole stage-content system
//    (My Garden, Plant Detail, Home's tasks) key off; dropping it would
//    silently default every crop to "2-4 weeks" forever.
// The mockup's 2d asked for an email tied to a weekly digest promise this
// app can't keep (no backend to send it from) — that promise is still
// dropped, but the address itself is collected again as the last onboarding
// step. No account/auth system backs it — it's a local field, not a login —
// but for a brand-new garden (no `existing` profile) providing it is what
// actually triggers `saveProfile`; skipping shows the schedule for this
// session only and nothing survives a restart. That gate only applies to
// first-time setup — editing an already-saved garden via Settings always
// persists on Skip too, since forcing email again on every edit would
// punish returning users for a choice they already made once.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { BED_SIZES, CropKey, SunExposure } from '../engines/scheduleEngine';
import { formatBedArea, formatBedSize, UnitSystem } from '../utils/units';
import { PlantedBucket } from '../engines/alertsEngine';
import { fetchWeather, geocodeSearch, reverseGeocode } from '../api/weather';
import { saveProfile } from '../api/storage';
import { CURRENT_SCHEMA_VERSION, GardenProfile, LocationInfo } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { CROP_CATEGORY, CropCategory, cropIcon, cropIconBg, cropLabel } from '../cropMeta';
import { CropIcon } from '../components/ui';
import { NEXT_ACTION, STAGE_HEADLINE } from '../plantStageContent';

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
];
const CATEGORY_OPTIONS: { key: CropCategory; label: string; icon: string }[] = [
  { key: 'vegetable', label: 'Vegetables', icon: '🥕' },
  { key: 'fruit', label: 'Fruit', icon: '🍓' },
  { key: 'flower', label: 'Flowers', icon: '🌻' },
];
const BUCKETS: { key: PlantedBucket; label: string }[] = [
  { key: 'w0', label: 'Not planted' },
  { key: 'w2', label: '1–4 wks' },
  { key: 'w4', label: '4–8 wks' },
  { key: 'w8', label: '8+ wks' },
];
const SUN_OPTIONS: { key: SunExposure; icon: string; label: string; description: string }[] = [
  { key: 'full', icon: '☀️', label: 'Full sun all day', description: '6+ hours, no real shade' },
  { key: 'morning', icon: '🌤️', label: 'Morning sun, afternoon shade', description: 'Common in coastal fog areas' },
  { key: 'shade', icon: '⛅', label: 'Mostly shade', description: 'Dappled or under 4 hrs direct' },
];
const STEP_LABELS = ['seed', 'sprout', 'leaf', 'bloom'];
const STEP_JUSTIFY = ['flex-start', 'center', 'center', 'flex-end'] as const;

type Step = 'crops' | 'payoff' | 'location' | 'space' | 'save' | 'email';

function StepDots({ current }: { current: 0 | 1 | 2 | 3 }) {
  const fillPct = (current + 1) * 25;
  return (
    <View style={styles.dotsWrap}>
      <View style={styles.dotsRow}>
        <View style={styles.dotsTrack} />
        <View style={[styles.dotsFill, { width: `${fillPct}%` }]} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dotSlot, { justifyContent: STEP_JUSTIFY[i] }]}>
            <View style={[styles.dot, i < current && styles.dotFilled, i === current && styles.dotCurrent]} />
          </View>
        ))}
      </View>
      <Text style={styles.dotsLabel}>
        {STEP_LABELS[current]} · step {current + 1} of 4
      </Text>
    </View>
  );
}

export default function OnboardingScreen({
  existing,
  onDone,
  onCancel,
  onOpenPaywall,
}: {
  existing: GardenProfile | null;
  onDone: (p: GardenProfile) => void;
  onCancel?: () => void;
  onOpenPaywall: () => void;
}) {
  const [step, setStep] = useState<Step>('crops');
  const [crops, setCrops] = useState<Set<CropKey>>(new Set(existing?.crops ?? []));
  const [category, setCategory] = useState<CropCategory>('vegetable');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [plantedWeeks, setPlantedWeeks] = useState<Partial<Record<CropKey, PlantedBucket>>>(
    existing?.plantedWeeks ?? {}
  );
  const [sun, setSun] = useState<SunExposure | null>(existing?.sun ?? null);
  const [bedKey, setBedKey] = useState<string | null>(
    existing ? `${existing.bedWidthFt}x${existing.bedLengthFt}` : '4x8'
  );
  const [gardenType, setGardenType] = useState<'raised' | 'ground'>(existing?.gardenType ?? 'raised');
  const [notificationsEnabled, setNotificationsEnabled] = useState(existing?.notificationsEnabled ?? true);
  const [email, setEmail] = useState(existing?.email ?? '');

  const [location, setLocation] = useState<LocationInfo | null>(existing?.location ?? null);
  const [locating, setLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  function toggleCrop(c: CropKey) {
    const next = new Set(crops);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCrops(next);
  }

  async function useMyLocation() {
    setLocating(true);
    setLocationHint(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setShowManualEntry(true);
        setLocationHint('No problem, type your city instead and everything still works.');
        return;
      }
      // High (not Balanced) forces an actual GPS fix instead of a coarse
      // WiFi/cell-tower estimate — the latter tends to snap to the nearest
      // heavily-mapped metro (e.g. San Francisco) for a rural address.
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, label });
    } catch {
      setShowManualEntry(true);
      setLocationHint("Couldn't read your location. Type your city instead.");
    } finally {
      setLocating(false);
    }
  }

  async function searchManualLocation() {
    const query = manualQuery.trim();
    if (!query) return;
    setSearching(true);
    setLocationHint(null);
    try {
      const found = await geocodeSearch(query);
      if (!found) {
        setLocationHint('No match for that. Try a nearby city or town.');
        return;
      }
      setLocation(found);
    } catch {
      setLocationHint('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }

  const cropList = Array.from(crops).filter((c): c is CropKey => c !== 'other');
  const bed = BED_SIZES.find((b) => b.key === bedKey) ?? BED_SIZES[BED_SIZES.length - 1];
  const units: UnitSystem = existing?.units ?? 'imperial';
  const step0Valid = crops.size > 0;
  const step1Valid = !!location && !!sun;
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());

  async function finish(
    finalSun: SunExposure,
    finalLocation: LocationInfo | null,
    finalEmail?: string,
    persist = true
  ) {
    setSaving(true);
    try {
      let weather = null;
      let weatherFetchedAt: string | null = null;
      if (finalLocation) {
        try {
          weather = await fetchWeather(finalLocation.lat, finalLocation.lon);
          weatherFetchedAt = new Date().toISOString();
        } catch {
          weather = null;
        }
      }

      const profile: GardenProfile = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        crops: Array.from(crops),
        plantedWeeks,
        sun: finalSun,
        bedWidthFt: bed.widthFt,
        bedLengthFt: bed.lengthFt,
        gardenType,
        // Not asked here — see file header. Method defaults to drip for a
        // brand-new garden; the emitter/spacing numbers are left unset so
        // the Settings pills start blank rather than pre-highlighted —
        // scheduleEngine falls back to 12"/12"/0.5 GPH until the user picks.
        // An edit preserves whatever was set in Settings rather than
        // silently reverting it.
        method: existing?.method ?? 'drip',
        lineSpacingIn: existing?.lineSpacingIn,
        emitterSpacingIn: existing?.emitterSpacingIn,
        emitterGph: existing?.emitterGph,
        location: finalLocation,
        weather,
        weatherFetchedAt,
        scheduledReminders: existing?.scheduledReminders ?? [],
        notificationsEnabled,
        harvests: existing?.harvests ?? [],
        taskCompletions: existing?.taskCompletions ?? {},
        photos: existing?.photos ?? [],
        units: existing?.units,
        email: finalEmail?.trim() || existing?.email,
        isPro: existing?.isPro,
        savedAt: new Date().toISOString(),
      };

      if (persist) {
        await saveProfile(profile);
      }
      onDone(profile);
    } catch {
      Alert.alert('Could not save your garden', 'Something went wrong writing to this device. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function skipToEstimates() {
    finish(sun ?? 'full', location);
  }

  // Payoff preview content — real, derived from the crops actually picked,
  // reusing the same stage copy My Garden and Plant Detail show.
  const previewCrops = cropList.slice(0, 3);
  const n = Math.max(1, cropList.length);
  const weekCounts = [n, Math.max(1, n - 1), n + 1, Math.max(1, n - 1)];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step !== 'payoff' && (
          <StepDots current={step === 'crops' ? 0 : step === 'location' ? 1 : step === 'space' ? 2 : 3} />
        )}

        {step === 'crops' && (
          <>
            <View style={styles.topRow}>
              {onCancel ? (
                <TouchableOpacity onPress={onCancel} accessibilityRole="button">
                  <Text style={styles.back}>‹ Back to my garden</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.eyebrow}>Getting Started</Text>
            <Text style={styles.h1}>What are you growing?</Text>
            <Text style={styles.sub}>
              Pick what's planted or what you're planning to grow. We'll turn it into a personalized
              garden to-do list.
            </Text>

            <TouchableOpacity
              style={styles.categoryDropdown}
              onPress={() => setCategoryMenuOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${CATEGORY_OPTIONS.find((o) => o.key === category)!.label}`}
            >
              <Text style={styles.categoryDropdownIcon}>
                {CATEGORY_OPTIONS.find((o) => o.key === category)!.icon}
              </Text>
              <Text style={styles.categoryDropdownLabel}>
                {CATEGORY_OPTIONS.find((o) => o.key === category)!.label}
              </Text>
              <Text style={styles.categoryDropdownChevron}>{categoryMenuOpen ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {categoryMenuOpen ? (
              <View style={styles.categoryMenu}>
                {CATEGORY_OPTIONS.map((opt, i) => {
                  const sel = opt.key === category;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.categoryMenuItem,
                        i === CATEGORY_OPTIONS.length - 1 && styles.categoryMenuItemLast,
                        sel && styles.categoryMenuItemSelected,
                      ]}
                      onPress={() => {
                        setCategory(opt.key);
                        setCategoryMenuOpen(false);
                      }}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: sel }}
                    >
                      <Text style={styles.categoryMenuIcon}>{opt.icon}</Text>
                      <Text style={sel ? styles.categoryMenuLabelSelected : styles.categoryMenuLabel}>
                        {opt.label}
                      </Text>
                      {sel ? <Text style={styles.categoryMenuCheck}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {(existing?.isPro ? [...FREE_CROPS, ...PRO_CROPS] : FREE_CROPS).filter((c) => CROP_CATEGORY[c] === category)
              .length === 0 ? (
              <View style={styles.categoryEmptyCard}>
                <Text style={styles.categoryEmptyText}>
                  {CATEGORY_OPTIONS.find((o) => o.key === category)!.label} are part of Sprout Pro. You can add
                  them after upgrading, later in Settings.
                </Text>
              </View>
            ) : null}

            <View style={styles.cropGrid}>
              {(existing?.isPro ? [...FREE_CROPS, ...PRO_CROPS] : FREE_CROPS)
                .filter((c) => CROP_CATEGORY[c] === category)
                .map((c) => {
                const selected = crops.has(c);

                if (!selected) {
                  return (
                    <TouchableOpacity
                      key={c}
                      style={styles.cropCard}
                      onPress={() => toggleCrop(c)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                    >
                      <CropIcon crop={c} size={23} />
                      <Text style={styles.cropLabel}>{cropLabel(c)}</Text>
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
                      {BUCKETS.map((b) => {
                        const sel = (plantedWeeks[c] ?? 'w2') === b.key;
                        return (
                          <TouchableOpacity
                            key={b.key}
                            style={[styles.pill, sel && styles.pillSelected]}
                            onPress={() => setPlantedWeeks({ ...plantedWeeks, [c]: b.key })}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: sel }}
                          >
                            <Text style={sel ? styles.pillTextSelected : styles.pillText}>{b.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>

            {!existing?.isPro && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Unlock more with Pro</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.proCropRow}>
                  {PRO_CROPS.slice(0, 4).map((c) => (
                    <TouchableOpacity key={c} style={styles.proCropCard} onPress={onOpenPaywall} accessibilityRole="button">
                      <CropIcon crop={c} size={19} />
                      <Text style={styles.proCropLabel}>{cropLabel(c)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.proCropRow}>
                  {PRO_CROPS.slice(4, 8).map((c) => (
                    <TouchableOpacity key={c} style={styles.proCropCard} onPress={onOpenPaywall} accessibilityRole="button">
                      <CropIcon crop={c} size={19} />
                      <Text style={styles.proCropLabel}>{cropLabel(c)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!existing?.isPro && (
              <TouchableOpacity style={styles.proBanner} onPress={onOpenPaywall} accessibilityRole="button">
                <View style={styles.proBannerIconWrap}>
                  <Text style={styles.proBannerIcon}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proBannerTitle}>Unlock all crops</Text>
                  <Text style={styles.proBannerSub}>Plus the season view · $3/mo</Text>
                </View>
                <View style={styles.proBannerCta}>
                  <Text style={styles.proBannerCtaText}>Try free</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.spacer} />
            <TouchableOpacity
              style={[styles.cta, !step0Valid && styles.ctaDisabled]}
              onPress={() => setStep('payoff')}
              disabled={!step0Valid}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>
                Continue{crops.size > 0 ? ` · ${crops.size} selected` : ''}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'payoff' && (
          <>
            <Text style={styles.eyebrow}>Here's the idea</Text>
            <Text style={styles.h1}>Your first month, already planned</Text>
            <Text style={styles.sub}>
              Built from {cropList.map(cropLabel).join(' and ').toLowerCase() || 'your crops'} alone. Two
              more questions make the dates exact for your yard.
            </Text>

            <View style={styles.payoffCard}>
              <Text style={styles.chartCaption}>Tasks per week</Text>
              <View style={styles.weekLabelRow}>
                {['WK 1', 'WK 2', 'WK 3', 'WK 4'].map((w) => (
                  <Text key={w} style={styles.weekLabel}>{w}</Text>
                ))}
              </View>
              <View style={styles.weekBarRow}>
                {weekCounts.map((count, i) => (
                  <View
                    key={i}
                    style={[
                      styles.weekBar,
                      (i === 0 || i === 1) && styles.weekBarSolid,
                      i === 2 && styles.weekBarHarvest,
                      i === 3 && styles.weekBarLight,
                    ]}
                  >
                    <Text style={i === 3 ? styles.weekBarTextLight : styles.weekBarText}>{count}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegendRow}>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: colors.mossGreen }]} />
                  <Text style={styles.chartLegendText}>Garden tasks</Text>
                </View>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: colors.mustard }]} />
                  <Text style={styles.chartLegendText}>Harvest week</Text>
                </View>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: colors.seasonTrack }]} />
                  <Text style={styles.chartLegendText}>Lighter week</Text>
                </View>
              </View>
              <View style={{ gap: space.sm }}>
                {previewCrops.length > 0 ? (
                  previewCrops.map((c) => (
                    <View key={c} style={styles.previewRow}>
                      <View style={[styles.previewIconWrap, { backgroundColor: cropIconBg(c) }]}>
                        <CropIcon crop={c} size={15} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewTitle}>{STAGE_HEADLINE[c]?.w2 ?? cropLabel(c)}</Text>
                        <Text style={styles.previewSub}>{NEXT_ACTION[c]?.w2 ?? ''}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.previewSub}>Pick a crop to see its first-month tasks.</Text>
                )}
              </View>
            </View>

            <View style={styles.estimateNote}>
              <Text style={styles.estimateIcon}>📍</Text>
              <Text style={styles.estimateText}>
                These dates are estimates until Sprout knows where you garden.{' '}
                <Text style={styles.estimateBold}>Your frost date can move them by up to 5 weeks.</Text>
              </Text>
            </View>

            <View style={styles.spacer} />
            <TouchableOpacity style={styles.cta} onPress={() => setStep('location')} accessibilityRole="button">
              <Text style={styles.ctaText}>Make it exact (2 questions)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={skipToEstimates} accessibilityRole="button" disabled={saving}>
              <Text style={styles.skipText}>
                {saving ? 'Saving…' : 'Use the estimates for now'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'location' && (
          <>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => setStep('crops')} accessibilityRole="button">
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Your yard</Text>
            <Text style={styles.h1}>Where's your garden?</Text>
            <Text style={styles.sub}>
              Local frost dates and forecasts put your tasks on the right week, not a generic zone chart.
            </Text>

            <TouchableOpacity
              style={[styles.locationCard, location && styles.locationCardSelected]}
              onPress={useMyLocation}
              accessibilityRole="button"
            >
              <Text style={styles.locationIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>
                  {location ? location.label : locating ? 'Locating…' : 'Use my location'}
                </Text>
                <Text style={styles.locationSub}>
                  {location ? 'Tap to change' : "We'll ask your permission, or you can type it instead"}
                </Text>
                {profileWeatherChips(location)}
              </View>
              {location ? (
                <View style={styles.locationCheck}>
                  <Text style={styles.locationCheckText}>✓</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {locating ? <ActivityIndicator style={styles.spinner} /> : null}

            {!showManualEntry && !location ? (
              <TouchableOpacity onPress={() => setShowManualEntry(true)} accessibilityRole="button">
                <Text style={styles.link}>Enter your address instead</Text>
              </TouchableOpacity>
            ) : null}

            {showManualEntry ? (
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.input}
                  value={manualQuery}
                  onChangeText={setManualQuery}
                  placeholder="Street address, city, or ZIP"
                  placeholderTextColor={colors.inkSoft}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={searchManualLocation}
                  accessibilityLabel="Address"
                />
                <TouchableOpacity style={styles.findButton} onPress={searchManualLocation} disabled={searching} accessibilityRole="button">
                  {searching ? <ActivityIndicator color={colors.onPine} /> : <Text style={styles.findButtonText}>Find</Text>}
                </TouchableOpacity>
              </View>
            ) : null}

            {locationHint ? (
              <Text style={styles.hint}>{locationHint}</Text>
            ) : (
              <Text style={styles.privacyNote}>
                Coordinates stay on your phone. Only the weather lookup leaves the device, and it needs
                no account.
              </Text>
            )}

            <Text style={styles.sectionLabel}>Sun exposure</Text>
            {SUN_OPTIONS.map((s) => {
              const sel = sun === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.optionRow, sel && styles.optionRowSelected]}
                  onPress={() => setSun(s.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                >
                  <Text style={styles.optionIcon}>{s.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{s.label}</Text>
                    <Text style={styles.optionDescription}>{s.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.spacer} />
            <TouchableOpacity
              style={[styles.cta, !step1Valid && styles.ctaDisabled]}
              onPress={() => setStep('space')}
              disabled={!step1Valid}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'space' && (
          <>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => setStep('location')} accessibilityRole="button">
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Growing space</Text>
            <Text style={styles.h1}>Your growing space</Text>
            <Text style={styles.sub}>Tell us how you grow and roughly how big.</Text>

            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeCard, gardenType === 'raised' && styles.typeCardSelected]}
                onPress={() => setGardenType('raised')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gardenType === 'raised' }}
              >
                <Text style={styles.typeIcon}>🪵</Text>
                <Text style={styles.typeLabel}>Raised bed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeCard, gardenType === 'ground' && styles.typeCardSelected]}
                onPress={() => setGardenType('ground')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gardenType === 'ground' }}
              >
                <Text style={styles.typeIcon}>🌍</Text>
                <Text style={styles.typeLabel}>In ground</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bedRow}>
              {BED_SIZES.map((b) => {
                const sel = bedKey === b.key;
                return (
                  <TouchableOpacity
                    key={b.key}
                    style={[styles.bedCard, sel && styles.bedCardSelected]}
                    onPress={() => setBedKey(b.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                  >
                    <View style={styles.bedSwatchWrap}>
                      <View
                        style={[
                          styles.bedSwatch,
                          sel && styles.bedSwatchSelected,
                          { width: 14 + b.widthFt * 4, height: 14 + b.lengthFt * 1.6 },
                        ]}
                      />
                    </View>
                    <Text style={styles.bedLabel}>{formatBedSize(b.widthFt, b.lengthFt, units)}</Text>
                    <Text style={styles.bedSqFt}>{formatBedArea(b.widthFt, b.lengthFt, units)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Your plan so far</Text>
            <View style={styles.recapCard}>
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Crops</Text>
                <Text style={styles.recapValue}>
                  {cropList.map((c) => `${cropIcon(c)} ${cropLabel(c)}`).join(' · ') || 'None yet'}
                </Text>
              </View>
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Place</Text>
                <Text style={styles.recapValue}>
                  {[location?.label, sun ? SUN_OPTIONS.find((s) => s.key === sun)?.label : null]
                    .filter(Boolean)
                    .join(' · ') || 'Not set'}
                </Text>
              </View>
              <View style={[styles.recapRow, styles.recapRowLast]}>
                <Text style={styles.recapKey}>Space</Text>
                <Text style={styles.recapValue}>
                  {gardenType === 'raised' ? 'Raised bed' : 'In ground'} ·{' '}
                  {formatBedSize(bed.widthFt, bed.lengthFt, units)}
                </Text>
              </View>
            </View>
            <Text style={styles.recapFoot}>
              Your task calendar is built from these three. Change any of it later in Settings.
            </Text>

            <View style={styles.spacer} />
            <TouchableOpacity style={styles.cta} onPress={() => setStep('save')} accessibilityRole="button">
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'save' && (
          <>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => setStep('space')} accessibilityRole="button">
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Last thing</Text>
            <Text style={styles.h1}>Save your garden</Text>
            <Text style={styles.sub}>
              {existing
                ? 'Your plan is ready. This updates the garden already saved on your phone.'
                : "Your plan is ready. Add your email next to save it, otherwise it won't survive a restart."}
            </Text>

            <TouchableOpacity
              style={styles.notifRow}
              onPress={() => setNotificationsEnabled((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: notificationsEnabled }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>Daily task reminder</Text>
                <Text style={styles.notifSub}>One morning nudge when something needs doing</Text>
              </View>
              <View style={[styles.switch, notificationsEnabled && styles.switchOn]}>
                <View style={[styles.knob, notificationsEnabled && styles.knobOn]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.lockedRow}
              onPress={existing?.isPro ? undefined : onOpenPaywall}
              accessibilityRole="button"
              disabled={existing?.isPro}
            >
              {existing?.isPro ? null : <Text style={styles.lockIcon}>🔒</Text>}
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>Stage & harvest alerts</Text>
                <Text style={styles.notifSub}>Feed, prune, and pick reminders per crop</Text>
              </View>
              <Text style={existing?.isPro ? styles.includedTag : styles.proTag}>
                {existing?.isPro ? '✓ Included' : 'PRO'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.trialCard} onPress={onOpenPaywall} accessibilityRole="button">
              <View style={styles.trialHeadRow}>
                <Text style={styles.trialEyebrow}>Sprout Pro</Text>
                <View style={styles.trialRule} />
                <Text style={styles.trialPrice}>$3/mo</Text>
              </View>
              <Text style={styles.trialTitle}>Try Pro free for 14 days</Text>
              <View style={{ gap: 6, marginBottom: 13 }}>
                <Text style={styles.trialBullet}>
                  <Text style={styles.trialCheck}>✓</Text> Every crop, not just the free four
                </Text>
                <Text style={styles.trialBullet}>
                  <Text style={styles.trialCheck}>✓</Text> Stage & harvest alerts per crop
                </Text>
                <Text style={styles.trialBullet}>
                  <Text style={styles.trialCheck}>✓</Text> The season view and year-over-year comparison
                </Text>
              </View>
              <View style={styles.trialCta}>
                <Text style={styles.trialCtaText}>Start free trial</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.spacer} />
            <TouchableOpacity style={styles.cta} onPress={() => setStep('email')} accessibilityRole="button">
              <Text style={styles.ctaText}>See your customized schedule</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'email' && (
          <>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => setStep('save')} accessibilityRole="button">
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Almost there</Text>
            <Text style={styles.h1}>Create your account</Text>
            <Text style={styles.sub}>
              Your email is what saves this garden to your phone for good. We don't send
              anything to it: no digest, no marketing.
            </Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email address"
            />

            <View style={styles.spacer} />
            <TouchableOpacity
              style={[styles.cta, !emailValid && styles.ctaDisabled]}
              onPress={() => finish(sun ?? 'full', location, email)}
              disabled={saving || !emailValid}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || !emailValid }}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPine} />
              ) : (
                <Text style={styles.ctaText}>Create my account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => finish(sun ?? 'full', location, undefined, !!existing)}
              accessibilityRole="button"
              disabled={saving}
            >
              <Text style={styles.skipText}>{saving ? 'Saving…' : 'Skip for now'}</Text>
            </TouchableOpacity>
            {!existing ? (
              <Text style={styles.skipWarning}>
                Without an email, your garden won't be saved. Closing or restarting the app
                will lose it.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function profileWeatherChips(location: LocationInfo | null) {
  if (!location) return null;
  return (
    <Text style={styles.locationCoords}>
      {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl },
  topRow: { minHeight: 20, marginBottom: space.xs, justifyContent: 'center' },
  back: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  dotsWrap: { marginBottom: space.sm },
  dotsRow: { flexDirection: 'row', alignItems: 'center', position: 'relative', height: 26, gap: 6 },
  dotsTrack: { position: 'absolute', left: 0, right: 0, top: 12, height: 2, backgroundColor: colors.line },
  dotsFill: { position: 'absolute', left: 0, top: 12, height: 2, backgroundColor: colors.mossGreen },
  dotSlot: { flex: 1, flexDirection: 'row' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line, borderWidth: 4, borderColor: colors.paper },
  dotFilled: { backgroundColor: colors.mossGreen },
  dotCurrent: { width: 11, height: 11, borderRadius: 6, borderWidth: 3, backgroundColor: colors.mossGreen },
  dotsLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 7,
  },
  h1: { fontFamily: fonts.heading, fontSize: 25, lineHeight: 29, color: colors.pine, marginBottom: 6 },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginBottom: 15 },
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
  categoryMenuItemLast: { borderBottomWidth: 0 },
  categoryMenuItemSelected: { backgroundColor: colors.selectedBg },
  categoryMenuIcon: { fontSize: 16 },
  categoryMenuLabel: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  categoryMenuLabelSelected: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.mossGreen },
  categoryMenuCheck: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.mossGreen },
  categoryEmptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
  },
  categoryEmptyText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
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
  bucketPrompt: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.3, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 9,
    marginTop: 13,
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13, marginBottom: 9 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  proCropRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  proCropCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    opacity: 0.75,
  },
  proCropIcon: { fontSize: 19 },
  proCropLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10.5, marginTop: 4, color: colors.ink, textAlign: 'center' },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.pine,
    borderRadius: 15,
    padding: 14,
    marginTop: 3,
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
  spacer: { height: space.xl },
  cta: { backgroundColor: colors.pine, borderRadius: radius.xl, padding: 16, alignItems: 'center' },
  ctaDisabled: { backgroundColor: colors.disabled },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
  skipText: {
    textAlign: 'center',
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.inkSoft,
    paddingVertical: 11,
  },
  skipWarning: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.clay,
    paddingHorizontal: 12,
  },
  payoffCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
    marginBottom: 13,
  },
  chartCaption: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 8,
  },
  weekLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  weekLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkSoft },
  weekBarRow: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  weekBar: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  weekBarSolid: { backgroundColor: colors.mossGreen },
  weekBarHarvest: { backgroundColor: colors.mustard },
  weekBarLight: { backgroundColor: colors.seasonTrack },
  weekBarText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.onPine },
  weekBarTextLight: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.inkSoft },
  chartLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 13,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chartLegendDot: { width: 8, height: 8, borderRadius: 4 },
  chartLegendText: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
  previewRow: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  previewIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  previewIconText: { fontSize: 15 },
  previewTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  previewSub: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  estimateNote: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.sevSoonBg,
    borderRadius: 15,
    padding: 13,
  },
  estimateIcon: { fontSize: 14 },
  estimateText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft },
  estimateBold: { fontFamily: fonts.bodyBold, color: colors.ink },
  locationCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
    marginBottom: 9,
  },
  locationCardSelected: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  locationIcon: { fontSize: 19 },
  locationTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  locationSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  locationCoords: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkSoft, marginTop: 6 },
  locationCheck: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.mossGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCheckText: { color: colors.onPine, fontFamily: fonts.bodyBold, fontSize: 11 },
  spinner: { marginBottom: space.sm },
  link: {
    fontFamily: fonts.bodySemiBold,
    color: colors.mossGreen,
    fontSize: 13,
    textDecorationLine: 'underline',
    marginBottom: space.sm,
  },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  findButton: {
    backgroundColor: colors.pine,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 15,
    minWidth: 72,
    alignItems: 'center',
  },
  findButtonText: { fontFamily: fonts.bodyBold, color: colors.onPine, fontSize: 13 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginBottom: 16, lineHeight: 18 },
  privacyNote: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft, marginBottom: 16 },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    marginBottom: 9,
  },
  optionRowSelected: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  optionIcon: { fontSize: 18 },
  optionLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  optionDescription: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  typeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 11,
    paddingHorizontal: 12,
  },
  typeCardSelected: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  typeIcon: { fontSize: 17 },
  typeLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  bedRow: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  bedCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  bedCardSelected: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  bedSwatchWrap: { width: '100%', height: 26, alignItems: 'center', justifyContent: 'center' },
  bedSwatch: { borderWidth: 2, borderColor: colors.inkSoft, borderRadius: 4 },
  bedSwatchSelected: { borderColor: colors.mossGreen, backgroundColor: 'rgba(76,122,82,0.14)' },
  bedLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink, marginTop: 8 },
  bedSqFt: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  recapCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: 14,
  },
  recapRow: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  recapRowLast: { borderBottomWidth: 0 },
  recapKey: {
    width: 55,
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  recapValue: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.ink },
  recapFoot: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.inkSoft, marginBottom: 14 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 14,
    marginBottom: 9,
  },
  notifTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  notifSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  switch: { width: 42, height: 25, borderRadius: 13, backgroundColor: colors.line, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.mossGreen },
  knob: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff', marginLeft: 3 },
  knobOn: { marginLeft: 20 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 14,
    marginBottom: 15,
  },
  lockIcon: { fontSize: 15 },
  proTag: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
  },
  includedTag: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.mossGreen,
  },
  trialCard: { backgroundColor: colors.pine, borderRadius: radius.xl, padding: 16 },
  trialHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 },
  trialEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mustard,
  },
  trialRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  trialPrice: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.pineFoot },
  trialTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 20, color: colors.onPine, marginBottom: 10 },
  trialBullet: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.pineFoot },
  trialCheck: { color: colors.mustard },
  trialCta: { backgroundColor: colors.mustard, borderRadius: 13, padding: 13, alignItems: 'center' },
  trialCtaText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.pine },
});
