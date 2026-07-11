import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { checkAssets } from "../src/safeguards/assetGuard";
import { reviewScriptContent } from "../src/safeguards/contentGuard";
import { useTempProject } from "./helpers";

describe("content and asset safeguards", () => {
  useTempProject();

  it("warns when intro and outro production assets are missing", async () => {
    const assets = await checkAssets(defaultConfig);

    expect(assets.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("intro"), expect.stringContaining("outro")]),
    );
    expect(assets.found).toMatchObject({ intro: [], outro: [] });
  });

  it("passes when required brand, overlay, intro, and outro assets exist", async () => {
    await writeFile("assets/brand/channel_logo.png", "logo", "utf8");
    await writeFile("assets/brand/channel_watermark.png", "watermark", "utf8");
    await writeFile("assets/overlays/subtitle_panel.png", "overlay", "utf8");
    await writeFile("assets/intro/intro_frame.jpg", "intro", "utf8");
    await writeFile("assets/outro/outro_frame.jpg", "outro", "utf8");

    await expect(checkAssets(defaultConfig)).resolves.toMatchObject({ passed: true, warnings: [] });
  });

  it("warns on excessive clickbait title framing", () => {
    const warnings = reviewScriptContent(
      [
        "# ŞOK! İNANILMAZ GERÇEK!!!",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "clickbait_title", severity: "warning" }),
      ]),
    );
  });

  it("warns when a script is too short for the long-form target", () => {
    const warnings = reviewScriptContent(
      [
        "# Sessiz Gezegen",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "too_short", severity: "warning" })]),
    );
  });

  it("detects an intro hook after markdown title and section headings", () => {
    const filler = Array.from({ length: 1210 }, (_, index) =>
      index % 2 === 0 ? "sakin" : "olasılık",
    ).join(" ");
    const warnings = reviewScriptContent(
      [
        "# Kozmik Işık",
        "",
        "## Başlangıç",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "",
        filler,
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings.map((warning) => warning.code)).not.toContain("missing_intro_hook");
  });

  it("blocks incomplete or non-Turkish production script output", () => {
    const warnings = reviewScriptContent(
      [
        "# Uykunun Derinliği",
        "",
        "**Narration:**",
        "Uykunun derinliklerinde sakin bir bilimkurgu yolculuğu başlar",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "incomplete_script", severity: "blocker" }),
        expect.objectContaining({ code: "non_turkish_production_text", severity: "blocker" }),
      ]),
    );
  });

  it("blocks malformed Turkish production labels from local model output", () => {
    const warnings = reviewScriptContent(
      [
        "# Uykuluk Yıldızları",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "Anlatyıcı: Bu satır local modelin bozduğu bir üretim etiketidir.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "malformed_production_label",
          details: { labelFamily: "narration", labelIssue: "misspelled_variant" },
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks unaccented production labels because exact Turkish labels are required", () => {
    const warnings = reviewScriptContent(
      [
        "# Uykuluk Yıldızları",
        "",
        "Anlatici: Bu satır aksansız bir üretim etiketidir.",
        "Gorsel: Bu satır da aksansız bir görsel etiketidir.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "malformed_production_label",
          details: { labelFamily: "narration", labelIssue: "unaccented_variant" },
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks dash-separated production labels because exact colon labels are required", () => {
    const warnings = reviewScriptContent(
      [
        "# Uykuluk Yıldızları",
        "",
        "Görsel - Bu satır local modelin tireli görsel etiketidir.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "malformed_production_label",
          details: { labelFamily: "visual", labelIssue: "unknown_related_label" },
          severity: "blocker",
        }),
      ]),
    );
  });

  it("classifies unknown related production labels without storing raw label text", () => {
    const warnings = reviewScriptContent(
      [
        "# Uykuluk Yıldızları",
        "",
        "Görüntü: Bu satır modele yakın ama onaylı olmayan bir görsel etiket kullandırır.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "malformed_production_label",
          details: { labelFamily: "visual", labelIssue: "unknown_related_label" },
          severity: "blocker",
        }),
      ]),
    );
    expect(JSON.stringify(warnings)).not.toContain("Görüntü");
  });

  it("blocks repeated sentence loops from local model output", () => {
    const repeated =
      "Anlatıcı: Bu kaybolma, bilim insanlarının yeni teoriler geliştirmesini zorunlu kılıyor.";
    const warnings = reviewScriptContent(
      [
        "# Uykuluk Yıldızları",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        repeated,
        repeated,
        repeated,
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated_sentence_loop",
          details: {
            repeatCount: "3",
            sentenceFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
          },
          severity: "blocker",
        }),
      ]),
    );
    expect(JSON.stringify(warnings)).not.toContain(repeated);
  });
});
