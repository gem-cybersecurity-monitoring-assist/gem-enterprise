// User-facing copy mandated (verbatim where noted) by TikTok's Direct Post UX
// guidelines: https://developers.tiktok.com/doc/content-sharing-guidelines
// Keep these strings in one place so the publishing UI and its tests agree.

/** Verbatim: shown when commercial disclosure is on but nothing is selected. */
export const COMMERCIAL_SELECTION_REQUIRED_TEXT =
  "You need to indicate if your content promotes yourself, a third party, or both.";

/** Verbatim: shown on the "only me" privacy option while Branded content is selected. */
export const BRANDED_PRIVATE_BLOCKED_TEXT =
  "Branded content visibility cannot be set to private.";

export const MUSIC_CONFIRMATION_URL =
  "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const BRANDED_CONTENT_POLICY_URL =
  "https://www.tiktok.com/legal/page/global/bc-policy/en";

/**
 * The label TikTok will apply to the post. "Branded content" (alone or
 * together with "Your brand") resolves to "Paid partnership".
 */
export function commercialLabelPreview(yourBrand: boolean, brandedContent: boolean): string | null {
  if (brandedContent) return "Your video will be labeled as “Paid partnership”.";
  if (yourBrand) return "Your video will be labeled as “Promotional content”.";
  return null;
}

