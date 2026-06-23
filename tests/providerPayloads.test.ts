import { describe, expect, it } from "vitest";
import {
  parseIdeasProviderPayload,
  parseProductionPackageProviderPayload,
  stripProviderThinking,
} from "../src/stages/providerPayloads";

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

  it("rejects malformed production-package payloads before artifact rendering", () => {
    expect(() =>
      parseProductionPackageProviderPayload(
        JSON.stringify({
          popupCards: ["card"],
          lowerThirds: ["lower"],
          youtube: { title: "title", description: "description" },
        }),
      ),
    ).toThrow(/Invalid production package provider response/);
  });

  it("normalizes common production-package key variants", () => {
    expect(
      parseProductionPackageProviderPayload(
        JSON.stringify({
          popup_cards: ["card"],
          lower_thirds: ["lower"],
          youtube: {
            title: "title",
            description: "description",
            tags: ["tag"],
          },
        }),
      ),
    ).toEqual({
      popupCards: ["card"],
      lowerThirds: ["lower"],
      youtube: {
        title: "title",
        description: "description",
        tags: ["tag"],
      },
    });
  });

  it("removes leading thinking traces from markdown script output", () => {
    expect(stripProviderThinking("<think>private analysis</think>\n\n# Script")).toBe("# Script");
  });
});
