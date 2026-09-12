// purchases.ts
// Real subscription purchases via RevenueCat, which handles Apple's receipt
// validation for us so this still-server-less app (see storage.ts's "no
// server, no userId" design) doesn't need to build its own validation
// backend just to sell a subscription.
//
// REVENUECAT_API_KEY below is a placeholder. Replace it with the public
// "Apple" API key from your RevenueCat project (Project settings > API
// keys) before any of this can do something real. Until it looks like a
// real key, initPurchases() deliberately no-ops rather than crashing the
// app — every other function here already returns a safe "nothing to
// report" value when unconfigured, so the rest of the app (PaywallScreen,
// App.tsx) doesn't need its own separate "is this even set up yet" branch.
//
// ENTITLEMENT_ID and the two package types this reads (monthly/annual)
// must match what's set up in the RevenueCat dashboard: an Entitlement
// named "pro", attached to a Monthly and an Annual product in your
// current Offering. Those same product identifiers also need to match
// ios/GardenWise.storekit (see that file) for local simulator testing
// before real App Store Connect products exist.

import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const REVENUECAT_API_KEY = 'YOUR_REVENUECAT_PUBLIC_APPLE_API_KEY';
const ENTITLEMENT_ID = 'pro';

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

function isProEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

/** The real, current entitlement status from RevenueCat/Apple — null when
 * not configured yet or the check failed (network down, etc.), which
 * callers should treat as "don't change what's already saved locally"
 * rather than as "not Pro." */
export async function fetchCurrentEntitlement(): Promise<boolean | null> {
  if (!configured) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return isProEntitlement(info);
  } catch {
    return null;
  }
}

/** Fires whenever RevenueCat's view of the entitlement changes — a
 * renewal, an expiration, a billing issue resolving, a purchase made
 * outside the app's own purchase flow. Returns an unsubscribe function. */
export function onEntitlementChange(callback: (isPro: boolean) => void): () => void {
  if (!configured) return () => {};
  const listener = (info: CustomerInfo) => callback(isProEntitlement(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export interface SubscriptionPlans {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
}

/** The real packages configured in RevenueCat's current Offering, with
 * their real store-localized prices — null for either (or both) when not
 * configured, the offering has no such package yet, or the fetch failed.
 * PaywallScreen falls back to its own placeholder pricing copy whenever a
 * package comes back null, rather than showing a blank price. */
export async function fetchPlans(): Promise<SubscriptionPlans> {
  if (!configured) return { monthly: null, yearly: null };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return { monthly: current?.monthly ?? null, yearly: current?.annual ?? null };
  } catch {
    return { monthly: null, yearly: null };
  }
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'error';

/** Buys a package. 'cancelled' means the user dismissed the system
 * purchase sheet themselves — not a real error, so callers shouldn't show
 * an error alert for it, just quietly go back to where they were. */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return isProEntitlement(result.customerInfo) ? 'success' : 'error';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Re-links a previous purchase to this install — the mechanism for a
 * reinstall or a new device, since this app has no accounts of its own to
 * carry that across for you (see storage.ts). Returns whether an active
 * "pro" entitlement was found, not just whether the call succeeded. */
export async function restore(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.restorePurchases();
    return isProEntitlement(info);
  } catch {
    return false;
  }
}
