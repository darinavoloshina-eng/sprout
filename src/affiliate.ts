// affiliate.ts
// Every Amazon "Buy" link goes through here, so the Associates tag and the
// required disclosure live in one place.

export const AMAZON_TAG = 'gardenwise-20';

/** Amazon's required statement, shown wherever the app has Buy links. */
export const AFFILIATE_DISCLOSURE = 'As an Amazon Associate, GardenWise earns from qualifying purchases.';

/** A softer disclosure for under a single Buy button. */
export const COMMISSION_NOTE = 'We may earn a small commission from Amazon links.';

/** A tagged Amazon search, used until a specific product is chosen. */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

/** A tagged link to one specific product (its ASIN). */
export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;
}
