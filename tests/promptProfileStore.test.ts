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
    expect(promptProfileDigest(science)).toBe(
      "8aa19d4d645a349755cf503d58c175827019e43f10e7c71fad6c66c3caee5438",
    );
    expect(
      promptProfileDigest({
        ...science,
        generationPrompt: `${science.generationPrompt} Değiştirilmiş içerik.`,
      }),
    ).not.toBe(promptProfileDigest(science));
    expect(promptProfiles).toHaveLength(5);
  });

  it("requires an operator brief for the custom profile", async () => {
    expect(selectPromptProfile("custom-brief").requiresOperatorBrief).toBe(true);
  });
});
