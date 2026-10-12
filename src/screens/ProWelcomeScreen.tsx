// ProWelcomeScreen.tsx
// Shown once, right after a successful Pro purchase, to ask for an email.
// Deliberately optional — "Not now" is always there. App Review rejects
// apps that require an email or account before a non-account in-app
// purchase (Guideline 5.1.1), and Apple never shares the buyer's Apple ID
// email with us, so asking nicely at the moment someone's most invested
// is the honest way to reach paying customers.
//
// The weekly garden email starts switched on (it's a feature of what they
// just bought, and it's one tap to turn off); marketing tips start off and
// only turn on from an explicit tap, same rule as everywhere else
// emailOptIn is set (see types.ts).

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GardenProfile } from '../types';
import { saveProfile } from '../api/storage';
import { recordEmailOptIn } from '../api/subscribe';
import { colors, fonts, radius, space } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProWelcomeScreenProps {
  profile: GardenProfile;
  /** True when Pro came from the local preview toggle, not a real
   * purchase (see PaywallScreen) — says so, rather than thanking someone
   * for a payment that never happened. */
  isPreview: boolean;
  onProfileChange: (p: GardenProfile) => void;
  onDone: () => void;
}

export default function ProWelcomeScreen({ profile, isPreview, onProfileChange, onDone }: ProWelcomeScreenProps) {
  const [email, setEmail] = useState(profile.email ?? '');
  const [weekly, setWeekly] = useState(true);
  const [tips, setTips] = useState(!!profile.emailOptIn);

  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);

  function save() {
    if (!valid) return;
    const updated: GardenProfile = {
      ...profile,
      email: trimmed,
      emailRemindersEnabled: weekly,
      emailOptIn: tips,
    };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
    // The weekly email syncs through App.tsx's garden-sync effect; the
    // mailing list needs its own call, and only when it actually changed.
    if (tips !== !!profile.emailOptIn) recordEmailOptIn(trimmed, tips);
    onDone();
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{isPreview ? 'GardenWise Pro · preview' : 'GardenWise Pro'}</Text>
        <Text style={styles.headline}>Welcome to Pro 🌱</Text>
        <Text style={styles.sub}>
          {isPreview
            ? "This is a local preview with no payment behind it, but everything's unlocked to try: every crop, the season view, and stage & harvest alerts."
            : "Thanks for supporting GardenWise. Everything's unlocked: every crop, the season view, and stage & harvest alerts."}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get your garden's week by email</Text>
          <Text style={styles.cardBody}>
            One email on Sunday evenings with what to plant, feed, and pick that week, plus your watering plan.
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
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel="Email address"
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setWeekly((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: weekly }}
          >
            <View style={[styles.checkbox, weekly && styles.checkboxChecked]}>
              {weekly ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Email me my garden's jobs every Sunday</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setTips((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: tips }}
          >
            <View style={[styles.checkbox, tips && styles.checkboxChecked]}>
              {tips ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Also send occasional garden tips and product news</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.ctaButton, !valid && styles.ctaButtonDisabled]}
          onPress={save}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid }}
        >
          <Text style={styles.ctaText}>Save and start growing</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} accessibilityRole="button" style={styles.notNow}>
          <Text style={styles.notNowText}>Not now</Text>
        </TouchableOpacity>
        <Text style={styles.finePrint}>You can change any of this later in Settings.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pine },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xl,
  },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mustard,
    marginBottom: 9,
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
    color: colors.onPine,
    marginBottom: 10,
  },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 21, color: colors.pineFoot, marginBottom: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.xl,
    padding: space.lg,
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
  cardBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.pineFoot },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.mustard },
  checkboxMark: { color: colors.pine, fontFamily: fonts.bodyBold, fontSize: 12 },
  checkLabel: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.onPine },
  spacer: { flex: 1, minHeight: space.xl },
  ctaButton: {
    backgroundColor: colors.mustard,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.pine },
  notNow: { alignItems: 'center', paddingVertical: 14 },
  notNowText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.pineFoot },
  finePrint: { textAlign: 'center', fontFamily: fonts.body, fontSize: 11, color: colors.pineFoot, opacity: 0.8 },
});
