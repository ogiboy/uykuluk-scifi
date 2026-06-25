import { describe, expect, it } from "vitest";
import { parseIdeasProviderPayload } from "../src/stages/providerPayloads";

const baseIdea = {
  id: "idea_001",
  title: "Buzaltı Haritası",
  premise: "Buz altında ölçülen ritmin kesin kanıt olmadığını varsayalım.",
  targetDuration: "25 dakika",
  style: "sakin sinematik bilimkurgu anlatısı",
  estimatedDifficulty: "medium",
  riskLevel: "medium",
  fit: "Buzaltı haritası görsel keşif ve bilimsel ihtiyatı birleştirir.",
};

describe("live qwen idea quality regressions", () => {
  it("rejects English scientific leftovers with Turkish suffixes", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...baseIdea,
            premise:
              "Buz altı okyanusunda ölçülen sıcaklık anomaly’sı doğal süreç olabilir mi diye sorgulanır.",
          },
        ]),
      ),
    ).toThrow(/English operator text/i);
  });

  it("rejects repeated generic exploration phrasing seen in repaired qwen fits", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...baseIdea,
            fit: "UykulukSciFi bu arşivin bilinmeyen sınırlarını incelemeyi öngörür.",
          },
          {
            ...baseIdea,
            id: "idea_002",
            title: "Lav Kütüphanesi",
            premise: "Lav çizgilerinin doğal süreç olabileceğini dikkatle sorgular.",
            fit: "UykulukSciFi lav belleğinin bilinmeyen amaçlarını incelemeyi öngörür.",
          },
        ]),
      ),
    ).toThrow(/generic "incelemeyi öngörmek" boilerplate/i);
  });

  it("rejects repeated weak journey and clue boilerplate from live qwen ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...baseIdea,
            premise:
              "Arşivci tohumların nereden geldiğini anlamak için yola çıkar; sonuç kesin kanıt değildir.",
          },
          {
            ...baseIdea,
            id: "idea_002",
            title: "Android Mezarlığı",
            fit: "Android mezarlığı arkeoloji, metal yorgunluğu ve etik ihtiyatı birleştirir.",
            premise:
              "Kazı ekibi paslı mezarların neden oluştuğunu anlamak için yola çıkar; doğal açıklama hâlâ mümkündür.",
          },
        ]),
      ),
    ).toThrow(/generic "anlamak için yola çıkmak" boilerplate/i);
  });

  it("rejects repeated fit and premise verbs from accepted but weak qwen slates", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...baseIdea,
            fit: "UykulukSciFi buz tabakasını inceleyerek bilimsel ihtiyat kurar.",
            premise: "Buz ritmi doğal bir dalgayı yansıtmakta olabilir.",
          },
          {
            ...baseIdea,
            id: "idea_002",
            title: "Lav Kütüphanesi",
            premise: "Lav çizgisi eski soğuma izlerini yansıtmakta olabilir.",
            fit: "UykulukSciFi lav belleğini inceleyerek görsel merak kurar.",
          },
          {
            ...baseIdea,
            id: "idea_003",
            title: "Nötrino Gecikmesi",
            premise: "Nötrino kaydı uzak ışık sınırlarını yansıtmakta olabilir.",
            fit: "UykulukSciFi geciken sinyali inceleyerek sakin merak kurar.",
          },
        ]),
      ),
    ).toThrow(/generic "yansıtmakta" boilerplate|generic "inceleyerek" boilerplate/i);
  });
});
