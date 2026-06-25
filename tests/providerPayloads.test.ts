import { describe, expect, it } from "vitest";
import { parseIdeasProviderPayload } from "../src/stages/providerPayloads";

const validIdea = {
  id: "idea_001",
  title: "Sessiz Gezegen",
  premise: "Buz altinda sakli bir okyanusun temkinli kesfi.",
  targetDuration: "20 dakika",
  style: "sinematik bilimkurgu",
  estimatedDifficulty: "medium",
  riskLevel: "low",
  fit: "UykulukSciFi tonuna uygun.",
};

describe("provider payload parsing", () => {
  it("accepts an ideas object or root array while keeping schema validation strict", () => {
    expect(parseIdeasProviderPayload(JSON.stringify({ ideas: [validIdea] }))).toEqual([validIdea]);
    expect(parseIdeasProviderPayload(JSON.stringify([validIdea]))).toEqual([validIdea]);
  });

  it("normalizes common Ollama idea key variants and assigns deterministic local ids", () => {
    expect(
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            id: 1,
            title: "Rüya Kolonisi",
            premise: "Bir Mars kolonisi uyku döngülerini temkinli bir keşif hikayesine dönüştürür.",
            target_duration: 25,
            style: "Sakin ve sinematik bilimkurgu anlatısı",
            estimated_difficulty: "orta",
            risk_level: "düşük",
            fit: "UykulukSciFi'nin merak odaklı ve bilimsel ihtiyat taşıyan tonuna uygun.",
          },
        ]),
      ),
    ).toEqual([
      {
        id: "idea_001",
        title: "Rüya Kolonisi",
        premise: "Bir Mars kolonisi uyku döngülerini temkinli bir keşif hikayesine dönüştürür.",
        targetDuration: "25 dakika",
        style: "Sakin ve sinematik bilimkurgu anlatısı",
        estimatedDifficulty: "medium",
        riskLevel: "low",
        fit: "UykulukSciFi'nin merak odaklı ve bilimsel ihtiyat taşıyan tonuna uygun.",
      },
    ]);
  });

  it("rejects English or rating-only idea payloads from real local providers", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            id: 1,
            title: "The Dream Cycle Paradox",
            premise:
              "A team of sleep scientists discovers that human sleep cycles synchronize with cosmic phenomena.",
            targetDuration: "25 minutes",
            style: "Cinematic narrative with abstract visualizations",
            estimatedDifficulty: "medium",
            riskLevel: "medium",
            fit: "high",
          },
        ]),
      ),
    ).toThrow(/Invalid ideas provider response/);
  });

  it("rejects Turkish rating-only fit values from local providers", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            fit: "yüksek",
          },
        ]),
      ),
    ).toThrow(/Fit must be a Turkish explanation, not a rating/);
  });

  it("rejects English style text even when the rest of the idea is Turkish", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            style: "Calm cinematic science fiction with surreal imagery",
          },
        ]),
      ),
    ).toThrow(/Invalid ideas provider response/);
  });

  it("normalizes common UykulukSciFi brand spelling glitches in human-facing idea text", () => {
    expect(
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            fit: "UykulukSci, görsel anlatımla kozmik bağları derinleştirir.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Derin Arşiv",
            premise: "UykulukSciyFi için uzak bir arşivin kesin kanıt olmadığını varsayalım.",
          },
        ]),
      ),
    ).toEqual([
      {
        ...validIdea,
        fit: "UykulukSciFi, görsel anlatımla kozmik bağları derinleştirir.",
      },
      {
        ...validIdea,
        id: "idea_002",
        title: "Derin Arşiv",
        premise: "UykulukSciFi için uzak bir arşivin kesin kanıt olmadığını varsayalım.",
      },
    ]);
  });

  it("rejects duplicate local-model ideas instead of offering a weak review list", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Sessiz Gezegen",
            premise: "Aynı başlıkla farklı görünen ama operatör için tekrar eden fikir.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Karanlık Okyanus",
            premise: "Buz altinda sakli bir okyanusun temkinli kesfi.",
          },
        ]),
      ),
    ).toThrow(/distinct/i);
  });

  it("rejects repeated generic title motifs across the idea list", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Yıldızın İç Yüzü",
            premise: "Yıldızın içinde saklanan verinin kesin kanıt olmadığını varsayalım.",
            fit: "Yıldız motifi üzerinden temkinli bir bilimsel gizem kurar.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Yıldızlararası Arşiv",
            premise: "Uzaktaki bir arşivin yıldız ışığıyla bozulmuş olması mümkün olabilir.",
            fit: "Arşiv fikriyle sakin keşif tonunu destekler.",
          },
        ]),
      ),
    ).toThrow(/title motif/i);
  });

  it("rejects repeated premise frames across otherwise non-identical local-model ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Atmosferin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin atmosferindeki dalgaların belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Atmosfer ölçümlerini ihtiyatlı bir keşif sorusuna dönüştürür.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Sesin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin yüzeyindeki seslerin belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Ses verilerini sakin ve görsel bir araştırma hattına taşır.",
          },
          {
            ...validIdea,
            id: "idea_004",
            title: "Yüzeyin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin okyanusundaki ritimlerin belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Okyanus ritimlerini kesin hüküm vermeden bilimkurgu merakına bağlar.",
          },
        ]),
      ),
    ).toThrow(/repeated premise frame/i);
  });

  it("strips leading thinking blocks and JSON fences before parsing provider JSON", () => {
    const text = `<think>Model reasoning that must not become product state.</think>

\`\`\`json
${JSON.stringify([validIdea])}
\`\`\``;

    expect(parseIdeasProviderPayload(text)).toEqual([validIdea]);
  });

  it("extracts the first complete JSON payload from noisy local model prose", () => {
    const text = `Elbette, aşağıda JSON var:

${JSON.stringify({ ideas: [validIdea] })}

Not: Bu açıklama ürün durumuna yazılmamalı.`;

    expect(parseIdeasProviderPayload(text)).toEqual([validIdea]);
  });

  it("rejects invalid idea levels instead of widening them to arbitrary strings", () => {
    expect(() =>
      parseIdeasProviderPayload(JSON.stringify([{ ...validIdea, riskLevel: "unknown" }])),
    ).toThrow(/Invalid ideas provider response/);
  });
});
