import { describe, expect, it } from "vitest";
import {
  promptProfileDigest,
  promptProfiles,
  selectPromptProfile,
} from "../src/prompts/profiles/promptProfileStore";

describe("prompt profiles", () => {
  it("exposes Turkish built-ins with stable digests", () => {
    const science = selectPromptProfile("science-space");
    expect(science.labels.tr).toBe("Bilim ve Uzay");
    expect(science.genre).toBe("science-space");
    expect(promptProfileDigest(science)).toMatch(/^[a-f0-9]{64}$/);
    expect(promptProfiles).toHaveLength(5);
  });

  it("requires an operator brief for the custom profile", async () => {
    expect(selectPromptProfile("custom-brief").requiresOperatorBrief).toBe(true);
  });
});
