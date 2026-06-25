import { describe, expect, it } from "vitest";
import {
  scriptContinuationResponseFormat,
  parseScriptContinuationProviderPayload,
} from "../src/stages/scriptContinuation";
import { scriptContinuationMaxLength } from "../src/stages/scriptContinuationParsing";

describe("script continuation parsing", () => {
  it("accepts raw Turkish continuation text when a local model ignores the JSON wrapper", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "Anlatıcı: Sonda aynı yankıyı yeniden dinlediğinde ekip önce cihaz hatası olasılığını masaya yatırır.",
          "Görsel: Kontrol panelinde üç veri çizgisi yavaşça üst üste biner.",
          "Anlatıcı: Bu sahne kesin bir keşif ilan etmez; yalnızca daha dikkatli ölçüm yapılması gerektiğini hatırlatır.",
        ].join(" "),
      ),
    ).toBe(
      [
        "Anlatıcı: Sonda aynı yankıyı yeniden dinlediğinde ekip önce cihaz hatası olasılığını masaya yatırır.",
        "Görsel: Kontrol panelinde üç veri çizgisi yavaşça üst üste biner.",
        "Anlatıcı: Bu sahne kesin bir keşif ilan etmez; yalnızca daha dikkatli ölçüm yapılması gerektiğini hatırlatır.",
      ].join(" "),
    );
  });

  it("accepts fenced raw Turkish continuation text but not malformed JSON", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "```text",
          "Anlatıcı: Ekip bu kez aynı ölçümü daha yavaş tekrarlar.",
          "Görsel: Buz yüzeyindeki soluk çizgiler kontrol ekranına düşer.",
          "```",
        ].join("\n"),
      ),
    ).toBe(
      "Anlatıcı: Ekip bu kez aynı ölçümü daha yavaş tekrarlar.\nGörsel: Buz yüzeyindeki soluk çizgiler kontrol ekranına düşer.",
    );

    expect(() => parseScriptContinuationProviderPayload('{"text":"Anlatıcı: yarım"')).toThrow(
      /expected JSON|Invalid script continuation provider response/,
    );
  });

  it("recovers bounded Turkish text from malformed local-model text wrappers", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "{",
          '  "text": "Anlatıcı: Ekip bu kez ölçümü tek bir sonuca bağlamadan yeniden okur.',
          "Görsel: Ekranda ham veri, olası cihaz hatası ve doğal süreç kartları yan yana görünür.",
          'Anlatıcı: Böylece sahne kesin kanıt iddiası kurmadan merakı daha dikkatli bir soruya çevirir."',
          "}",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Anlatıcı: Ekip bu kez ölçümü tek bir sonuca bağlamadan yeniden okur.",
        "Görsel: Ekranda ham veri, olası cihaz hatası ve doğal süreç kartları yan yana görünür.",
        "Anlatıcı: Böylece sahne kesin kanıt iddiası kurmadan merakı daha dikkatli bir soruya çevirir.",
      ].join("\n"),
    );
  });

  it("recovers bounded Turkish text from malformed wrappers with trailing commas", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "{",
          '  "text": "Anlatıcı: Ekip bu ölçümü tek bir cevaba zorlamadan yeniden tartışır.',
          "Görsel: Masada ham veri, doğal açıklama ve cihaz hatası notları yan yana durur.",
          'Anlatıcı: Bu dikkatli duruş, merakı korurken iddiayı kanıt gibi sunmaz.",',
          "}",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Anlatıcı: Ekip bu ölçümü tek bir cevaba zorlamadan yeniden tartışır.",
        "Görsel: Masada ham veri, doğal açıklama ve cihaz hatası notları yan yana durur.",
        "Anlatıcı: Bu dikkatli duruş, merakı korurken iddiayı kanıt gibi sunmaz.",
      ].join("\n"),
    );
  });

  it("recovers complete Turkish text from malformed wrappers without a closing quote", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "{",
          '  "text": "Anlatıcı: Sonda bu kez aynı işareti daha sakin bir ölçümle karşılaştırır.',
          "Görsel: Karanlık panelde olası doğal açıklamalar küçük kartlar halinde açılır.",
          "Anlatıcı: Sahne kesin sonuç yerine dikkatli bir sonraki gözlem sorusu bırakır.",
          "}",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Anlatıcı: Sonda bu kez aynı işareti daha sakin bir ölçümle karşılaştırır.",
        "Görsel: Karanlık panelde olası doğal açıklamalar küçük kartlar halinde açılır.",
        "Anlatıcı: Sahne kesin sonuç yerine dikkatli bir sonraki gözlem sorusu bırakır.",
      ].join("\n"),
    );
  });

  it("ignores a short external note after a malformed Turkish text wrapper", () => {
    expect(
      parseScriptContinuationProviderPayload(
        [
          "{",
          '  "text": "Anlatıcı: Ekip sinyali önce sıradan bir süreç gibi ele alır.',
          "Görsel: Ölçüm panosunda olası hata payı ve doğal açıklama başlıkları görünür.",
          'Anlatıcı: Böylece merak, kanıt iddiasına dönüşmeden yavaşça büyür."',
          "}",
          "Not: JSON biçimi bozulduysa yalnızca metin alanını kullan.",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Anlatıcı: Ekip sinyali önce sıradan bir süreç gibi ele alır.",
        "Görsel: Ölçüm panosunda olası hata payı ve doğal açıklama başlıkları görünür.",
        "Anlatıcı: Böylece merak, kanıt iddiasına dönüşmeden yavaşça büyür.",
      ].join("\n"),
    );
  });

  it("keeps the continuation response schema below Ollama grammar repetition limits", () => {
    expect(scriptContinuationMaxLength).toBe(2400);
    expect(scriptContinuationResponseFormat.properties.text.maxLength).toBe(
      scriptContinuationMaxLength,
    );
  });
});
