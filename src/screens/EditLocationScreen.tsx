// EditLocationScreen.tsx
// Lightweight location/sun editor reached from Settings' "Location" row.
// Deliberately NOT the onboarding wizard: no crops/payoff/space/save/email
// steps and no wizard chrome, same pattern as EditCropsScreen.tsx. Before
// this existed, Settings routed "Location" through the full OnboardingScreen,
// which always starts at its first step — so changing your location meant
// paging back through crop selection first.
//
// Saving clears frostDates (when the coordinates actually changed) so
// useFrostDates, now mounted at the app root, re-estimates for the new
// spot instead of keeping the old one's dates. Weather is re-fetched right
// away rather than left to useLiveWeather's staleness check, which could
// otherwise keep showing the old location's forecast for up to 3 hours.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SunExposure } from '../engines/scheduleEngine';
import { fetchWeather, geocodeSearch, reverseGeocode } from '../api/weather';
import { saveProfile } from '../api/storage';
import { GardenProfile, LocationInfo } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { TabBar, TabKey } from '../components/ui';

const SUN_OPTIONS: { key: SunExposure; icon: string; label: string; description: string }[] = [
  { key: 'full', icon: '☀️', label: 'Full sun all day', description: '6+ hours, no real shade' },
  { key: 'morning', icon: '🌤️', label: 'Morning sun, afternoon shade', description: 'Common in coastal fog areas' },
  { key: 'shade', icon: '⛅', label: 'Mostly shade', description: 'Dappled or under 4 hrs direct' },
];

export interface EditLocationScreenProps {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onBack: () => void;
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function EditLocationScreen({
  profile,
  onProfileChange,
  onBack,
  activeTab,
  onTabPress,
}: EditLocationScreenProps) {
  const [location, setLocation] = useState<LocationInfo | null>(profile.location);
  const [sun, setSun] = useState<SunExposure>(profile.sun);
  const [locating, setLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const locationChanged =
    location?.lat !== profile.location?.lat || location?.lon !== profile.location?.lon;
  const canSave = !!location && (locationChanged || sun !== profile.sun) && !saving;

  async function handleSave() {
    if (!location) return;
    setSaving(true);
    try {
      let weather = profile.weather;
      let weatherFetchedAt = profile.weatherFetchedAt;
      if (locationChanged) {
        try {
          weather = await fetchWeather(location.lat, location.lon);
          weatherFetchedAt = new Date().toISOString();
        } catch {
          weather = null;
          weatherFetchedAt = null;
        }
      }
      const updated: GardenProfile = {
        ...profile,
        location,
        sun,
        weather,
        weatherFetchedAt,
        frostDates: locationChanged ? undefined : profile.frostDates,
      };
      onProfileChange(updated);
      await saveProfile(updated);
      onBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.topRow}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Location</Text>
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
              {location ? 'Tap to use your current location instead' : "We'll ask your permission, or you can type it instead"}
            </Text>
            {location ? (
              <Text style={styles.locationCoords}>
                {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
              </Text>
            ) : null}
          </View>
          {location ? (
            <View style={styles.locationCheck}>
              <Text style={styles.locationCheckText}>✓</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {locating ? <ActivityIndicator style={styles.spinner} /> : null}

        {!showManualEntry ? (
          <TouchableOpacity onPress={() => setShowManualEntry(true)} accessibilityRole="button">
            <Text style={styles.link}>{location ? 'Search a different address' : 'Enter your address instead'}</Text>
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
            <TouchableOpacity
              style={styles.findButton}
              onPress={searchManualLocation}
              disabled={searching}
              accessibilityRole="button"
            >
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

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color={colors.onPine} /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl },
  topRow: { minHeight: 20, marginBottom: space.xs, justifyContent: 'center', alignSelf: 'flex-start' },
  back: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.pine, marginTop: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginTop: 4, marginBottom: 16 },
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
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 9,
  },
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
  saveButton: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: { backgroundColor: colors.disabled },
  saveButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
});
