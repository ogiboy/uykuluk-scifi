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

    await expect(checkAssets(defaultConfig)).resolves.toMatchObject({
      passed: true,
      warnings: [],
    });
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
        expect.objectContaining({
          code: "clickbait_title",
          severity: "warning",
        }),
      ]),
    );
  });
});
