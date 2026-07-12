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
        expect.objectContaining({ code: "model_meta_commentary", severity: "blocker" }),
      ]),
    );
  });

  it("blocks local model prompt-compliance checklist leakage", () => {
    const warnings = reviewScriptContent(
      [
        "# Buzaltı Okyanusu",
        "",
        "Anlatıcı: Sonda buzun altındaki ölçümü kesin kanıt gibi sunmadan yeniden inceler.",
        "Görsel: Sonar ekranında yavaşça genişleyen mavi bir harita görünür.",
        "95 words. 738 characters. 4 sentences. All accents correct. No repetition. Preserved key details. Cinematic tone. Responsible speculation. No forbidden label variants. No repeated sentence loops. No hard limit exceeded. All requirements met. JSON object is complete. No errors.",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "model_meta_commentary", severity: "blocker" }),
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
        expect.objectContaining({ code: "literal_model_escape_text", severity: "blocker" }),
      ]),
    );
  });

  it("blocks repeated word stutter from local model output", () => {
    const warnings = reviewScriptContent(
      [
        "# Kuşak Gemisi",
        "",
        "Anlatıcı: Bu durum, Kuşak Gemisi’nin kor kor kor kor kor kor kor kor kor kor yapısını bozuyor.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "repeated_word_stutter", severity: "blocker" }),
      ]),
    );
  });

  it("blocks a complete local-model sentence repeated twice", () => {
    const repeated =
      "Anlatıcı: Bu gecikme, kolonilerin aynı veriyi iki farklı gerçeklik gibi yorumlamasına neden oluyor.";
    const warnings = reviewScriptContent(
      [
        "# Geciken Sinyal",
        "",
        "Anlatıcı: İlk ölçüm, operatörün dikkatini uzak kolonilere çeviriyor.",
        repeated,
        "Görsel: Kontrol ekranı karar ağacını gösterir.",
        repeated,
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "repeated_sentence_loop", severity: "blocker" }),
      ]),
    );
  });

  it("surfaces quantitative claims and blocks unsupported extraterrestrial certainty", () => {
    const warnings = reviewScriptContent(
      [
        "# Uzak Koloni",
        "",
        "Anlatıcı: Sinyalin 12,5 saniyede ulaştığı varsayılıyor; bu değer üretimden önce doğrulanmalı.",
        "Görsel: Sonuçlar, insanlığın evrende yalnız olmadığını açıkça gösteriyor.",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quantitative_claims_require_fact_check",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "unsupported_extraterrestrial_certainty",
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks provider artifact metadata from persisted script text", () => {
    const warnings = reviewScriptContent(
      [
        "# Kuşak Gemisi",
        "",
        "Anlatıcı: Arşivci bahçedeki değişimi sakin ve ihtiyatlı biçimde inceler.",
        "Görsel: Ekranda bitkilerin renk geçişi görünür.”} id=hook, section_id=idea_003, targetDuration=20 dakika.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "provider_artifact_metadata", severity: "blocker" }),
      ]),
    );
  });

  it("blocks markdown-formatted production labels in manually edited script text", () => {
    const warnings = reviewScriptContent(
      [
        "# Metalik Flora",
        "",
        "`Anlatıcı:` Ekip bu ölçümü kesin kanıt saymadan yeniden inceler.",
        "`Görsel:` Metalik yapraklar laboratuvar ışığında yavaşça döner.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "malformed_production_label",
          details: expect.objectContaining({ labelIssue: "markdown_formatted" }),
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks multi-sentence visual spans that would hide narration from TTS", () => {
    const warnings = reviewScriptContent(
      [
        "# Kumtaşının Fısıltısı",
        "",
        "Anlatıcı: Jeolog numuneyi dikkatle inceler.",
        "Görsel: Spektrometre verileri ekranda belirir. Bu sonuç yaşam kanıtı değildir.",
        "Anlatıcı: Ekip alternatif açıklamaları sınamaya devam eder.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ambiguous_visual_direction",
          details: { sentenceCount: "2" },
          severity: "blocker",
        }),
      ]),
    );
  });

  it("warns about character-name drift and repeated channel calls", () => {
    const warnings = reviewScriptContent(
      [
        "# Kumtaşının Fısıltısı",
        "",
        "Anlatıcı: Jeolog Elif ilk numuneyi dikkatle inceler.",
        "Görsel: Spektrometre verileri ekranda belirir.",
        "Anlatıcı: Jeolog Elara ikinci ölçümü yeniden değerlendirir.",
        "Anlatıcı: UykulukSciFi ile keşfe devam edelim.",
        "Anlatıcı: UykulukSciFi ile soruları koruyalım.",
        "Anlatıcı: UykulukSciFi kanalında yeniden buluşalım.",
      ].join("\n"),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "inconsistent_named_role",
          details: { role: "jeolog", distinctNameCount: "2" },
          severity: "warning",
        }),
        expect.objectContaining({ code: "repetitive_outro_call", severity: "warning" }),
      ]),
    );
  });

  it("does not mistake ordinary Turkish verbs for production labels", () => {
    const warnings = reviewScriptContent(
      [
        "# Kumtaşının Fısıltısı",
        "",
        "Anlatıcı: Hangi soruları soracağımızı artık daha iyi görüyoruz: Ölçümler uyuşuyor mu?",
        "Görsel: Soru listesi ekranda görünür.",
      ].join("\n"),
    );

    expect(warnings.map((warning) => warning.code)).not.toContain("malformed_production_label");
  });
});
