import { describe, expect, it } from "vitest";
import {
  BRANDED_PRIVATE_BLOCKED_TEXT,
  COMMERCIAL_SELECTION_REQUIRED_TEXT,
  commercialLabelPreview,
} from "@/lib/tokmetric/publishing/ux-copy";

// These strings are mandated by TikTok's Direct Post UX guidelines:
// https://developers.tiktok.com/doc/content-sharing-guidelines
describe("TikTok Direct Post UX copy", () => {
  it("uses the required commercial-selection prompt verbatim", () => {
    expect(COMMERCIAL_SELECTION_REQUIRED_TEXT).toBe(
      "You need to indicate if your content promotes yourself, a third party, or both.",
    );
  });

  it("uses the required branded-content privacy prompt verbatim", () => {
    expect(BRANDED_PRIVATE_BLOCKED_TEXT).toBe("Branded content visibility cannot be set to private.");
  });

  it("previews the label TikTok will apply", () => {
    expect(commercialLabelPreview(false, false)).toBeNull();
    expect(commercialLabelPreview(true, false)).toContain("Promotional content");
    expect(commercialLabelPreview(false, true)).toContain("Paid partnership");
    expect(commercialLabelPreview(true, true)).toContain("Paid partnership");
  });
});
