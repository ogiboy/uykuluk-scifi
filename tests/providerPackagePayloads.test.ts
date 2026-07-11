import { describe, expect, it } from "vitest";
import {
  parseProductionPackageProviderPayload,
  stripProviderThinking,
} from "../src/stages/providerPayloads";

describe("production package provider payload parsing", () => {
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
          youtube: { title: "title", description: "description", tags: ["tag"] },
        }),
      ),
    ).toEqual({
      popupCards: ["card"],
      lowerThirds: ["lower"],
      youtube: { title: "title", description: "description", tags: ["tag"] },
    });
  });

  it("removes leading thinking traces from markdown script output", () => {
    expect(stripProviderThinking("<think>private analysis</think>\n\n# Script")).toBe("# Script");
  });

  it("removes multiple leading thinking traces without lowercased-index slicing", () => {
    expect(
      stripProviderThinking('<think>İÇERİK</think>\n<think>second</think>\n\n{"ok":true}'),
    ).toBe('{"ok":true}');
  });
});
