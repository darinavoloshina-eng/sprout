// purchases.ts
// Real subscription purchases via RevenueCat, which handles Apple's receipt
// validation for us so this still-server-less app (see storage.ts's "no
// server, no userId" design) doesn't need to build its own validation
// backend just to sell a subscription.
//
// REVENUECAT_API_KEY is the real public "Apple" API key from the
// GardenWise (App Store) app in RevenueCat (Project settings > API keys).
// If this ever needs to go back to a placeholder (e.g. a fresh clone
// without real purchases set up), initPurchases() deliberately no-ops
// rather than crashing whenever the key starts with "YOUR_" — every other
// function here already returns a safe "nothing to report" value when
// unconfigured, so the rest of the app (PaywallScreen, App.tsx) doesn't
// need its own separate "is this even set up yet" branch.
//
// ENTITLEMENT_ID and the three package types this reads (monthly/annual/
// lifetime) must match what's set up in the RevenueCat dashboard: an
// Entitlement named "gardenwise_pro", attached to a Monthly, an Annual,
// and a Lifetime product in your current Offering. Those same product
// identifiers also need to match ios/GardenWise.storekit (see that file)
// for local simulator testing before real App Store Connect products
// exist. Lifetime is a one-time non-consumable purchase, not a
// subscription — Apple requires it to be set up as its own In-App
// Purchase (not a Subscription) in App Store Connect.

import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const REVENUECAT_API_KEY = 'appl_fyJBAzLShttHbtVlICeitQWWHso';
const ENTITLEMENT_ID = 'gardenwise_pro';

let configured = false;

/** Call once, at app launch. Safe to call even before a real API key is in
 * place — every other function here checks `isConfigured()` internally, so
 * nothing crashes, real purchases are just unavailable until it's set. */
export function initPurchases(): void {
  if (REVENUECAT_API_KEY.startsWith('YOUR_')) {
    console.warn(
      'GardenWise: RevenueCat API key is still a placeholder in src/purchases.ts — real purchases are disabled until it is set.'
    );
    return;
  }
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  configured = true;
}

export function isConfigured(): boolean {
  return configured;
}

export interface EntitlementStatus {
  isPro: boolean;
  // True when the active entitlement is the one-time Lifetime purchase
  // rather than a recurring subscription. RevenueCat sets willRenew to
  // false for non-renewing (lifetime) entitlements, and true for an active
  // subscription — meaningless when isPro is false, so always check that
  // first.
  isLifetime: boolean;
}

function readEntitlement(info: CustomerInfo): EntitlementStatus {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  return { isPro: entitlement !== undefined, isLifetime: entitlement?.willRenew === false };
}

/** The real, current entitlement status from RevenueCat/Apple — null when
 * not configured yet or the check failed (network down, etc.), which
 * callers should treat as "don't change what's already saved locally"
 * rather than as "not Pro." */
export async function fetchCurrentEntitlement(): Promise<EntitlementStatus | null> {
  if (!configured) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return readEntitlement(info);
  } catch {
    return null;
  }
}

/** Fires whenever RevenueCat's view of the entitlement changes — a
 * renewal, an expiration, a billing issue resolving, a purchase made
 * outside the app's own purchase flow. Returns an unsubscribe function. */
export function onEntitlementChange(callback: (status: EntitlementStatus) => void): () => void {
  if (!configured) return () => {};
  const listener = (info: CustomerInfo) => callback(readEntitlement(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export interface SubscriptionPlans {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
}

const NO_PLANS: SubscriptionPlans = { monthly: null, yearly: null, lifetime: null };

/** The real packages configured in RevenueCat's current Offering, with
 * their real store-localized prices — null for any not configured, missing
 * from the offering, or if the fetch failed. PaywallScreen falls back to
 * its own placeholder pricing copy whenever a package comes back null,
 * rather than showing a blank price. */
export async function fetchPlans(): Promise<SubscriptionPlans> {
  if (!configured) return NO_PLANS;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return {
      monthly: current?.monthly ?? null,
      yearly: current?.annual ?? null,
      lifetime: current?.lifetime ?? null,
    };
  } catch {
    return NO_PLANS;
  }
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'error';

/** Buys a package. 'cancelled' means the user dismissed the system
 * purchase sheet themselves — not a real error, so callers shouldn't show
 * an error alert for it, just quietly go back to where they were. */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return readEntitlement(result.customerInfo).isPro ? 'success' : 'error';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Re-links a previous purchase to this install — the mechanism for a
 * reinstall or a new device, since this app has no accounts of its own to
 * carry that across for you (see storage.ts). Returns the entitlement
 * found (isPro: false if none), not just whether the call succeeded. */
export async function restore(): Promise<EntitlementStatus> {
  if (!configured) return { isPro: false, isLifetime: false };
  try {
    const info = await Purchases.restorePurchases();
    return readEntitlement(info);
  } catch {
    return { isPro: false, isLifetime: false };
  }
}
