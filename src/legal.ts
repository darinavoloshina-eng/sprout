// legal.ts
// One place for the URLs Settings, the Paywall, and onboarding all need to
// link to, so there's a single spot to update if the privacy policy ever
// moves. TERMS_URL is Apple's own standard EULA rather than a custom one —
// App Store Connect attaches it automatically to any app that doesn't
// supply its own, and it's what the subscription-disclosure text below the
// Paywall's CTA is required to link to.

export const PRIVACY_POLICY_URL = 'https://claude.ai/code/artifact/cb5f0310-69fb-4ad0-97e2-f8c0ad6b8949';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
