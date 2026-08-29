// SettingsScreen.tsx
// Screen 1g from the design handoff. Adapted for honesty against what the
// app actually has: no subscriptions/IAP and no export — those rows are
// shown as informational rather than wired to features that don't exist.
// Crops, location, units, email, the notification toggle, and the Watering
// section below are all real and read/write the saved profile. Email is a
// local field only — see types.ts — editable here in case onboarding's
// email step was skipped or the address changes.
//
// Watering method used to be asked during onboarding; the redesign's setup
// flow deliberately drops that question (see OnboardingScreen.tsx), so new
// gardens default to drip/12"/12"/0.5 GPH with no way to change it — this
// section is that missing way out for anyone who actually hand-waters.
//
// Units is a display preference only — everything stays stored in imperial
// (see utils/units.ts) so scheduleEngine's calibrated formulas never see a
// metric branch; only the labels here and elsewhere convert.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  EMITTER_GPH_OPTIONS,
  EMITTER_SPACING_OPTIONS,
  LINE_SPACING_OPTIONS,
  WateringMethod,
} from '../engines/scheduleEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropLabel } from '../cropMeta';
import { saveProfile } from '../api/storage';
import { formatFlowGph, formatLengthIn, UnitSystem } from '../utils/units';
import { TabBar, TabKey } from '../components/ui';

const METHOD_OPTIONS: { key: WateringMethod; icon: string; label: string }[] = [
  { key: 'drip', icon: '💧', label: 'Drip' },
  { key: 'hand', icon: '🪣', label: 'Hand' },
];

const UNIT_OPTIONS: { key: UnitSystem; label: string }[] = [
  { key: 'imperial', label: '°F / in' },
  { key: 'metric', label: '°C / cm' },
];

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export interface SettingsScreenProps {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onEditGarden: () => void;
  onEditCrops: () => void;
  onDeleteAccount: () => void;
  onOpenPaywall: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function SettingsScreen({
  profile,
  onProfileChange,
  onEditGarden,
  onEditCrops,
  onDeleteAccount,
  onOpenPaywall,
  activeTab = 'settings',
  onTabPress,
}: SettingsScreenProps) {
  function toggleNotifications() {
    const updated: GardenProfile = {
      ...profile,
      notificationsEnabled: !profile.notificationsEnabled,
    };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  function updateWatering(patch: Partial<GardenProfile>) {
    const updated: GardenProfile = { ...profile, ...patch };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  const [emailDraft, setEmailDraft] = useState(profile.email ?? '');

  function saveEmail() {
    const trimmed = emailDraft.trim();
    setEmailDraft(trimmed);
    if (trimmed !== (profile.email ?? '')) {
      updateWatering({ email: trimmed || undefined });
    }
  }

  const cropNames = profile.crops.filter((c) => c !== 'other').map(cropLabel);
  const units: UnitSystem = profile.units ?? 'imperial';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {!profile.isPro ? (
          <TouchableOpacity style={styles.proBanner} onPress={onOpenPaywall} accessibilityRole="button">
            <View style={styles.proIconWrap}>
              <Text style={styles.proIconText}>🌟</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>Try Pro free for 14 days</Text>
              <Text style={styles.proSub}>All crops, season view, year-over-year · then $3/mo</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Email</Text>
            <TextInput
              style={styles.emailInput}
              value={emailDraft}
              onChangeText={setEmailDraft}
              onBlur={saveEmail}
              onSubmitEditing={saveEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email address"
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={onOpenPaywall} accessibilityRole="button">
            <Text style={styles.rowLabel}>Subscription</Text>
            <Text style={styles.rowValue}>{profile.isPro ? 'Sprout Pro (preview) ›' : 'Free plan ›'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Garden</Text>
        <View style={styles.group}>
          <TouchableOpacity style={[styles.row, styles.rowBordered]} onPress={onEditCrops} accessibilityRole="button">
            <Text style={styles.rowLabel}>Crops</Text>
            <Text style={styles.rowValue}>
              {cropNames.length ? joinNames(cropNames) : 'None yet'} ›
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowBordered]} onPress={onEditGarden} accessibilityRole="button">
            <Text style={styles.rowLabel}>Location</Text>
            <Text style={styles.rowValue}>{profile.location?.label ?? 'Not set'} ›</Text>
          </TouchableOpacity>
          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Units</Text>
            <View style={styles.pillRow}>
              {UNIT_OPTIONS.map((u) => {
                const sel = units === u.key;
                return (
                  <TouchableOpacity
                    key={u.key}
                    style={[styles.fieldPill, sel && styles.fieldPillSelected]}
                    onPress={() => updateWatering({ units: u.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={sel ? styles.fieldPillTextSelected : styles.fieldPillText}>{u.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Watering</Text>
        <View style={styles.group}>
          <View style={[styles.fieldRow, styles.rowBordered]}>
            <Text style={styles.rowLabel}>Method</Text>
            <View style={styles.pillRow}>
              {METHOD_OPTIONS.map((m) => {
                const sel = profile.method === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.fieldPill, sel && styles.fieldPillSelected]}
                    onPress={() => updateWatering({ method: m.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={sel ? styles.fieldPillTextSelected : styles.fieldPillText}>
                      {m.icon} {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {profile.method === 'drip' ? (
            <>
              <View style={[styles.fieldRow, styles.rowBordered]}>
                <Text style={styles.rowLabel}>Line spacing <Text style={styles.optionalHint}>(optional)</Text></Text>
                <View style={styles.pillRow}>
                  {LINE_SPACING_OPTIONS.map((v) => {
                    const sel = profile.lineSpacingIn === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.fieldPill, sel && styles.fieldPillSelected]}
                        onPress={() => updateWatering({ lineSpacingIn: sel ? undefined : v })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sel }}
                      >
                        <Text style={sel ? styles.fieldPillTextSelected : styles.fieldPillText}>
                          {formatLengthIn(v, units)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.fieldRow, styles.rowBordered]}>
                <Text style={styles.rowLabel}>Emitter spacing <Text style={styles.optionalHint}>(optional)</Text></Text>
                <View style={styles.pillRow}>
                  {EMITTER_SPACING_OPTIONS.map((v) => {
                    const sel = profile.emitterSpacingIn === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.fieldPill, sel && styles.fieldPillSelected]}
                        onPress={() => updateWatering({ emitterSpacingIn: sel ? undefined : v })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sel }}
                      >
                        <Text style={sel ? styles.fieldPillTextSelected : styles.fieldPillText}>
                          {formatLengthIn(v, units)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.rowLabel}>Emitter flow <Text style={styles.optionalHint}>(optional)</Text></Text>
                <View style={styles.pillRow}>
                  {EMITTER_GPH_OPTIONS.map((v) => {
                    const sel = profile.emitterGph === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.fieldPill, sel && styles.fieldPillSelected]}
                        onPress={() => updateWatering({ emitterGph: sel ? undefined : v })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sel }}
                      >
                        <Text style={sel ? styles.fieldPillTextSelected : styles.fieldPillText}>
                          {formatFlowGph(v, units)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.row, styles.rowBordered]}
            onPress={toggleNotifications}
            accessibilityRole="switch"
            accessibilityState={{ checked: profile.notificationsEnabled }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Task reminders</Text>
              <Text style={styles.rowSub}>Reminders for tasks you schedule from Home</Text>
            </View>
            <View style={[styles.switch, profile.notificationsEnabled && styles.switchOn]}>
              <View style={[styles.knob, profile.notificationsEnabled && styles.knobOn]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={profile.isPro ? undefined : onOpenPaywall}
            accessibilityRole="button"
            disabled={profile.isPro}
          >
            {profile.isPro ? null : <Text style={styles.lockIcon}>🔒</Text>}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Stage & harvest alerts</Text>
              <Text style={styles.rowSub}>Feed, prune, and pick reminders</Text>
            </View>
            <Text style={profile.isPro ? styles.includedTag : styles.proTag}>
              {profile.isPro ? '✓ Included' : 'PRO'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Data & privacy</Text>
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={onDeleteAccount} accessibilityRole="button">
            <Text style={styles.deleteLabel}>Delete account</Text>
            <Text style={styles.deleteChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Sprout 0.1.0 · your garden data is never sold</Text>
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
    gap: 8,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.pine },
  proBanner: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(217,166,46,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proIconText: { fontSize: 16 },
  proTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPine },
  proSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pineFoot, marginTop: 2 },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginTop: 2,
  },
  group: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  rowBordered: { borderBottomWidth: 1, borderBottomColor: colors.line },
  fieldRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fieldPill: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  fieldPillSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  fieldPillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  fieldPillTextSelected: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.onPine },
  emailInput: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
  },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: 14 },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.ink },
  optionalHint: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
  rowSub: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  rowValue: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft },
  switch: {
    width: 38,
    height: 23,
    borderRadius: 12,
    backgroundColor: colors.line,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.mossGreen },
  knob: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#fff',
    marginLeft: 3,
  },
  knobOn: { marginLeft: 18 },
  lockIcon: { fontSize: 13 },
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
  deleteLabel: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.clay },
  deleteChevron: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay },
  footer: {
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    paddingBottom: 8,
  },
});
