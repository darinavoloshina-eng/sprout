// PaywallScreen.tsx
// Screen 3b from the design handoff — the one destination for every Pro
// upsell (Settings banner, Calendar season lock, Log's year-over-year row).
//
// Real purchases go through RevenueCat (see purchases.ts) once it's been
// configured with a real API key. If that key is ever missing or reset to
// a placeholder, every purchases.ts function reports "not configured" and
// this screen falls back to its original preview behavior instead: a
// local toggle that flips profile.isPro with no payment behind it, so the
// rest of the app's Pro gates (extra crops, season view, year-over-year)
// can still be previewed and tested. That fallback is also why "Turn off
// Pro preview" only shows in the unconfigured case — once real purchases
// are live, isPro should only change because RevenueCat says it did (a
// real purchase, renewal, or cancellation), not because of a local toggle
// the user could tap to dodge paying. A real subscriber gets "Manage
// subscription" instead, which hands off to iOS's own subscription
// settings, same as any other app — except a Lifetime buyer, who gets
// neither: there's no subscription for that settings page to show, and no
// local toggle to dodge, so they just see a plain "it's yours for good"
// line (see profile.isLifetime below).
//
// The auto-renewal disclosure and Privacy Policy/Terms links below the CTA
// are required by App Store review for any subscription offering, real or
// not. Lifetime is a one-time purchase, not a subscription, so it gets its
// own non-renewal disclosure instead (see the plan === 'lifetime' branch).

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GardenProfile } from '../types';
import { saveProfile } from '../api/storage';
import { colors, fonts, radius, space } from '../theme';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../legal';
import { fetchPlans, isConfigured, purchase, restore as restorePurchases, SubscriptionPlans } from '../purchases';

const BENEFITS = [
  {
    icon: '🌱',
    title: 'Every crop in the catalogue',
    body: '35 vegetables, 6 fruits, and 12 trees, each with its own stage guidance',
  },
  {
    icon: '🗓',
    title: 'The season view',
    body: 'Know what to plant next and when to stop',
  },
  {
    icon: '📚',
    title: 'Year over year',
    body: 'GardenWise remembers last season and moves your reminders to match what actually happened',
  },
];

const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export interface PaywallScreenProps {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onClose: () => void;
}

export default function PaywallScreen({ profile, onProfileChange, onClose }: PaywallScreenProps) {
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [plans, setPlans] = useState<SubscriptionPlans>({ monthly: null, yearly: null, lifetime: null });
  const [busy, setBusy] = useState(false);
  const real = isConfigured();

  useEffect(() => {
    if (real) fetchPlans().then(setPlans);
  }, [real]);

  function setPro(isPro: boolean, isLifetime = false) {
    const updated: GardenProfile = { ...profile, isPro, isLifetime };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  async function handlePurchase() {
    if (!real) {
      setPro(true, plan === 'lifetime');
      Alert.alert(
        "You're on GardenWise Pro",
        "This is a local preview, not a real purchase. There's no payment behind it. All the crops, the season view, and year-over-year comparisons are unlocked now."
      );
      onClose();
      return;
    }
    const pkg = plan === 'yearly' ? plans.yearly : plan === 'lifetime' ? plans.lifetime : plans.monthly;
    if (!pkg) {
      Alert.alert('Not available yet', "This plan isn't ready in the store yet. Try again in a moment.");
      return;
    }
    setBusy(true);
    const outcome = await purchase(pkg);
    setBusy(false);
    if (outcome === 'success') {
      setPro(true, plan === 'lifetime');
      onClose();
    } else if (outcome === 'error') {
      Alert.alert('Purchase failed', 'Something went wrong completing the purchase. Check your connection and try again.');
    }
    // 'cancelled' — the user dismissed the system purchase sheet themselves, nothing to say.
  }

  async function handleRestore() {
    if (!real) {
      Alert.alert('Nothing to restore', "There's no payment account behind GardenWise Pro yet, so there's nothing to restore from.");
      return;
    }
    setBusy(true);
    const status = await restorePurchases();
    setBusy(false);
    if (status.isPro) {
      setPro(true, status.isLifetime);
      Alert.alert('Restored', 'Your GardenWise Pro subscription is back.');
      onClose();
    } else {
      Alert.alert('Nothing to restore', "We couldn't find an active subscription for this Apple ID.");
    }
  }

  function cancelPreview() {
    setPro(false);
  }

  const monthlyPrice = plans.monthly?.product.priceString ?? '$2.99';
  const yearlyPrice = plans.yearly?.product.priceString ?? '$24.99';
  const lifetimePrice = plans.lifetime?.product.priceString ?? '$59.99';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" style={styles.closeCircle}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRestore} accessibilityRole="button" disabled={busy}>
            <Text style={styles.restoreText}>Restore</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.eyebrow}>GardenWise Pro</Text>
        <Text style={styles.headline}>
          {profile.isPro
            ? "You're on\nGardenWise Pro\nalready"
            : 'Grow the\nwhole garden'}
        </Text>
        <Text style={styles.sub}>
          {profile.isPro
            ? real
              ? profile.isLifetime
                ? 'Thanks for buying GardenWise Pro for life.'
                : 'Thanks for subscribing.'
              : 'This is a local preview, not a real subscription.'
            : 'The GardenWise free plan covers 4 crops. GardenWise Pro is for the garden you actually have.'}
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.benefitTitleRow}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                </View>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        {profile.isPro ? (
          <>
            {real && profile.isLifetime ? (
              <Text style={styles.finePrint}>
                It's yours for good — no subscription, nothing to renew or cancel.
              </Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.ctaButtonSecondary}
                  onPress={real ? () => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL) : cancelPreview}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaTextSecondary}>{real ? 'Manage subscription' : 'Turn off Pro preview'}</Text>
                </TouchableOpacity>
                <Text style={styles.finePrint}>
                  {real
                    ? 'Opens your Apple ID subscription settings, where you can change plans or cancel.'
                    : 'Switches you back to the free tier locally, no account or payment involved.'}
                </Text>
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.planRow}>
              <TouchableOpacity
                style={[styles.planCard, plan === 'monthly' && styles.planCardSelected]}
                onPress={() => setPlan('monthly')}
                accessibilityRole="radio"
                accessibilityState={{ selected: plan === 'monthly' }}
              >
                <Text style={styles.planLabel}>Monthly</Text>
                <Text style={styles.planPrice}>{monthlyPrice}</Text>
                <Text style={styles.planUnit}>per month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planCard, plan === 'yearly' && styles.planCardSelectedYearly]}
                onPress={() => setPlan('yearly')}
                accessibilityRole="radio"
                accessibilityState={{ selected: plan === 'yearly' }}
              >
                <View style={styles.saveTag}>
                  <Text style={styles.saveTagText}>Save 30%</Text>
                </View>
                <Text style={[styles.planLabel, plan === 'yearly' && styles.planLabelYearly]}>Yearly</Text>
                <Text style={styles.planPrice}>{yearlyPrice}</Text>
                <Text style={styles.planUnit}>billed once a year</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planCard, plan === 'lifetime' && styles.planCardSelected]}
                onPress={() => setPlan('lifetime')}
                accessibilityRole="radio"
                accessibilityState={{ selected: plan === 'lifetime' }}
              >
                <Text style={styles.planLabel}>Lifetime</Text>
                <Text style={styles.planPrice}>{lifetimePrice}</Text>
                <Text style={styles.planUnit}>pay once</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.ctaButton} onPress={handlePurchase} accessibilityRole="button" disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.pine} />
              ) : (
                <Text style={styles.ctaText}>{plan === 'lifetime' ? 'Get lifetime access' : 'Start 14-day free trial'}</Text>
              )}
            </TouchableOpacity>
            {plan === 'lifetime' ? (
              <>
                {!real ? (
                  <Text style={styles.finePrint}>
                    Local preview only, nothing is charged. Real pricing would be {lifetimePrice}, once.
                  </Text>
                ) : null}
                <Text style={styles.finePrint}>
                  {real ? 'A one-time payment of' : 'Once billing is enabled, a one-time payment of'} {lifetimePrice}{' '}
                  is charged to your Apple ID account. Access never expires — no subscription, nothing to renew or
                  cancel.
                </Text>
              </>
            ) : (
              <>
                {!real ? (
                  <Text style={styles.finePrint}>
                    Local preview only, nothing is charged. Real pricing would be{' '}
                    {plan === 'yearly' ? yearlyPrice + '/year' : monthlyPrice + '/month'} after a trial.
                  </Text>
                ) : null}
                <Text style={styles.finePrint}>
                  {real ? 'Once' : 'Once billing is enabled:'} {plan === 'yearly' ? yearlyPrice + '/year' : monthlyPrice + '/month'}
                  , charged to your Apple ID account. Subscriptions auto-renew unless turned off at least 24 hours
                  before the current period ends, and can be managed or cancelled anytime in your device's Account
                  Settings.
                </Text>
              </>
            )}
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} accessibilityRole="link">
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
                <Text style={styles.legalLink}>Terms of Use</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pine },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xl,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: fonts.body, fontSize: 15, color: colors.pineFoot },
  restoreText: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.pineFoot },
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
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 21, color: colors.pineFoot, marginBottom: 20 },
  benefits: { gap: 12 },
  benefitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  benefitIcon: { fontSize: 15 },
  benefitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  benefitTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPine },
  benefitBody: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.pineFoot, marginTop: 2 },
  spacer: { height: space.lg },
  planRow: { flexDirection: 'row', gap: 9, marginBottom: 13 },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 15,
    padding: 13,
    position: 'relative',
  },
  planCardSelected: {
    backgroundColor: 'rgba(76,122,82,0.22)',
    borderColor: colors.mossGreen,
  },
  planCardSelectedYearly: {
    backgroundColor: 'rgba(217,166,46,0.16)',
    borderColor: colors.mustard,
  },
  saveTag: {
    position: 'absolute',
    top: -8,
    right: 11,
    backgroundColor: colors.mustard,
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  saveTagText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.pine,
  },
  planLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.pineFoot, marginBottom: 4 },
  planLabelYearly: { color: colors.sevFyiBg },
  planPrice: { fontFamily: fonts.monoSemiBold, fontSize: 20, color: colors.onPine },
  planUnit: { fontFamily: fonts.body, fontSize: 10.5, color: colors.pineFoot, marginTop: 3 },
  ctaButton: {
    backgroundColor: colors.mustard,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.pine },
  ctaButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
  },
  ctaTextSecondary: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
  finePrint: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.inkSoft,
    paddingVertical: 11,
    paddingBottom: 20,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  legalLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.pineFoot,
    textDecorationLine: 'underline',
  },
  legalDot: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
});
