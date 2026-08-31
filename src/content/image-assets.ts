const FALLBACK_PATH = "assets/item-icons/fallback.webp";

function extensionAssetUrl(path: string): string {
  const extensionRuntime = (globalThis as typeof globalThis & {
    chrome?: { runtime?: { getURL?: (path: string) => string } };
  }).chrome?.runtime;

  const pageOrigin = (globalThis as typeof globalThis & {
    location?: { origin?: string };
  }).location?.origin || "https://www.pathofexile.com";
  return extensionRuntime?.getURL
    ? extensionRuntime.getURL(path)
    : new URL(`/${path}`, pageOrigin).href;
}

export const GENERIC_ITEM_FALLBACK_ICON = extensionAssetUrl(FALLBACK_PATH);

export function getSafeItemImageUrl(source: unknown): string {
  const value = String(source || "").trim();
  if (/^assets\/item-icons\/[a-f0-9-]+\.webp$/i.test(value)) {
    return extensionAssetUrl(value);
  }
  if (
    /^https:\/\/web\.poecdn\.com\/gen\/image\/[A-Za-z0-9_-]+\/[a-f0-9]+\/[A-Za-z0-9._-]+$/i.test(value)
  ) {
    return value;
  }
  return GENERIC_ITEM_FALLBACK_ICON;
}
