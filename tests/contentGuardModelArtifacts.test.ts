import { describe, expect, it } from "vitest";
import { reviewScriptContent } from "../src/safeguards/contentGuard";

describe("content guard model artifact blockers", () => {
  it("blocks model self-evaluation commentary from persisted script text", () => {
    const warnings = reviewScriptContent(
      [
        "# Kuşak Gemisi",
        "",
        "Anlatıcı: Arşivci ölçümü kesin kanıt gibi sunmadan yeniden okur.",
        "Görsel: Bahçe kayıtları yavaşça kararan bir panelde görünür.",
        "All constraints met. This is the final JSON object. 10/10. Perfect response.",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "model_meta_commentary",
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks literal escaped control text from local model output", () => {
    const warnings = reviewScriptContent(
      [
        "# Kuşak Gemisi",
        "",
        "Anlatıcı: Arşivci ölçümü kesin kanıt gibi sunmadan yeniden okur.\\n\\nGörsel: Bahçe kayıtları panelde akar.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "literal_model_escape_text",
          severity: "blocker",
        }),
      ]),
    );
  });
});
