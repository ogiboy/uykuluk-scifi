import { describe, expect, it } from "vitest";
import {
  buildProductionScenesFromScript,
  buildWrappedSrt,
  renderVoiceoverText,
} from "../src/stages/productionPackageScript";

describe("production package script extraction", () => {
  it("keeps visual directions out of voiceover and subtitles", () => {
    const scenes = buildProductionScenesFromScript(
      [
        "# Sessiz Sinyal",
        "",
        "Anlatıcı: İlk ölçüm kesin kanıt gibi sunulmadan sakin biçimde yeniden dinlenir.",
        "Görsel: Kontrol odasında üç veri çizgisi yavaşça üst üste biner.",
        "Anlatıcı: İkinci ölçüm, doğal süreç ve cihaz hatası ihtimallerini yan yana tutar.",
        "Görsel: Buz yüzeyinde dar bir ışık çizgisi belirir.",
      ].join("\n"),
    );

    expect(renderVoiceoverText(scenes)).toBe(
      [
        "İlk ölçüm kesin kanıt gibi sunulmadan sakin biçimde yeniden dinlenir.",
        "",
        "İkinci ölçüm, doğal süreç ve cihaz hatası ihtimallerini yan yana tutar.",
      ].join("\n"),
    );
    expect(scenes).toEqual([
      expect.objectContaining({
        narration: "İlk ölçüm kesin kanıt gibi sunulmadan sakin biçimde yeniden dinlenir.",
        visualPrompt: expect.stringContaining(
          "Kontrol odasında üç veri çizgisi yavaşça üst üste biner.",
        ),
      }),
      expect.objectContaining({
        narration: "İkinci ölçüm, doğal süreç ve cihaz hatası ihtimallerini yan yana tutar.",
        visualPrompt: expect.stringContaining("Buz yüzeyinde dar bir ışık çizgisi belirir."),
      }),
    ]);

    const srt = buildWrappedSrt(scenes);

    expect(srt).not.toContain("Görsel:");
    expect(srt).not.toContain("Kontrol odasında");
    expect(subtitleTextLines(srt).every((line) => line.length <= 46)).toBe(true);
  });

  it("wraps long narration into multiple readable cues", () => {
    const scenes = buildProductionScenesFromScript(
      [
        "Anlatıcı: Bu uzun anlatım satırı, uzak bir buz kabuğunun altında ölçülen zayıf bir sinyalin hemen kanıt gibi sunulmadan dikkatle karşılaştırıldığını anlatır. Ekip aynı veriyi doğal süreç, cihaz hatası ve beklenmeyen bir okyanus akıntısı ihtimaliyle birlikte tartar.",
        "Görsel: Panelde üç olasılık kartı yan yana görünür.",
      ].join("\n"),
    );

    const srt = buildWrappedSrt(scenes);
    const textLines = subtitleTextLines(srt);

    expect(srt.split("\n\n").length).toBeGreaterThan(1);
    expect(textLines.length).toBeGreaterThan(2);
    expect(textLines.every((line) => line.length <= 46)).toBe(true);
  });
});

function subtitleTextLines(srt: string): string[] {
  return srt
    .split("\n")
    .filter((line) => line.trim())
    .filter((line) => !/^\d+$/u.test(line))
    .filter((line) => !line.includes("-->"));
}
