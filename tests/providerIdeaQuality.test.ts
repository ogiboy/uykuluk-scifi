import { describe, expect, it } from "vitest";
import { parseIdeasProviderPayload } from "../src/stages/providerPayloads";

const validIdea = {
  id: "idea_001",
  title: "Sessiz Okyanus",
  premise: "Buz altında saklı bir okyanusun temkinli keşfi kesin kanıt değildir.",
  targetDuration: "20 dakika",
  style: "sakin sinematik bilimkurgu",
  estimatedDifficulty: "medium",
  riskLevel: "low",
  fit: "UykulukSciFi tonuna uygun olabilir.",
};

describe("provider idea quality", () => {
  it("rejects English scientific lane terms copied into Turkish idea fields", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            premise:
              "Genç bir jeolog, bir exoplanetin yüzeyindeki lav tabakalarının kesin kanıt olmadığını varsayalım.",
          },
        ]),
      ),
    ).toThrow(/English operator text/);
  });

  it("rejects malformed brand fragments that common local models produce", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          { ...validIdea, fit: "Uykul, bu öykünün sakin bilimkurgu tonuna uygun olabilir." },
        ]),
      ),
    ).toThrow(/brand spelling/i);
  });

  it("rejects repeated sentence loops inside an otherwise parseable idea", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            premise:
              "Bu harita bilinmeyen bir deniz yıldızının yollarını gösteriyor olabilir mi? Bu harita bilinmeyen bir deniz yıldızının yollarını gösteriyor olabilir mi?",
          },
        ]),
      ),
    ).toThrow(/repeats the same sentence/i);
  });

  it("rejects repeated fit explanations across a local-model idea slate", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Lav Kütüphanesi",
            premise: "Genç bir jeolog, lav izlerinin kesin kanıt olmadığını varsayalım.",
            fit: validIdea.fit,
          },
        ]),
      ),
    ).toThrow(/slot-specific and distinct/i);
  });
});
