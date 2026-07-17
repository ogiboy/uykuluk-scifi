import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import {
  promptProfileDigest,
  selectPromptProfile,
} from "../src/prompts/profiles/promptProfileStore";
import {
  buildEpisodeBriefSnapshot,
  buildOperationSettingsSnapshot,
  episodeBriefSnapshotSchema,
  operationSettingsSnapshotSchema,
} from "../src/stages/episode/episodeSnapshotContracts";

describe("episode snapshot contracts", () => {
  it("binds the creation request to exact profile and settings digests", () => {
    const profile = selectPromptProfile("sci-fi");
    const settings = buildOperationSettingsSnapshot({
      config: defaultConfig,
      profile,
      runId: "run_20260717000000_abc123",
    });
    const brief = buildEpisodeBriefSnapshot({
      request: {
        profileId: "sci-fi",
        expectedProfileDigest: promptProfileDigest(profile),
        expectedSettingsDigest: settings.configDigest,
        operatorBrief: "Karanlık madde",
      },
      settings,
    });

    expect(episodeBriefSnapshotSchema.parse(brief)).toMatchObject({
      profileId: "sci-fi",
      operationSettingsDigest: settings.digest,
      runId: settings.runId,
    });
    expect(() =>
      buildEpisodeBriefSnapshot({
        request: {
          ...briefRequest(profile, settings.configDigest),
          expectedProfileDigest: "0".repeat(64),
        },
        settings,
      }),
    ).toThrow("Episode brief settings or profile changed");
    expect(() =>
      buildEpisodeBriefSnapshot({
        request: {
          ...briefRequest(profile, settings.configDigest),
          expectedSettingsDigest: "0".repeat(64),
        },
        settings,
      }),
    ).toThrow("Episode brief settings or profile changed");
  });

  it("rejects snapshots whose embedded digests do not bind their contents", () => {
    const profile = selectPromptProfile("sci-fi");
    const settings = buildOperationSettingsSnapshot({
      config: defaultConfig,
      profile,
      runId: "run_20260717000000_abc123",
    });
    const brief = buildEpisodeBriefSnapshot({
      request: {
        profileId: profile.id,
        expectedProfileDigest: promptProfileDigest(profile),
        expectedSettingsDigest: settings.configDigest,
      },
      settings,
    });

    expect(() =>
      operationSettingsSnapshotSchema.parse({
        ...settings,
        config: {
          ...settings.config,
          providers: {
            ...settings.config.providers,
            llm: { ...settings.config.providers.llm, model: "tampered" },
          },
        },
      }),
    ).toThrow("Operation settings config digest does not match");
    expect(() =>
      operationSettingsSnapshotSchema.parse({
        ...settings,
        profile: { ...settings.profile, generationPrompt: "tampered" },
      }),
    ).toThrow("Operation settings profile digest does not match");
    expect(() =>
      episodeBriefSnapshotSchema.parse({ ...brief, operationSettingsDigest: "0".repeat(64) }),
    ).toThrow("Episode brief snapshot digest does not match");
  });
});

function briefRequest(
  profile: ReturnType<typeof selectPromptProfile>,
  expectedSettingsDigest: string,
) {
  return {
    profileId: profile.id,
    expectedProfileDigest: promptProfileDigest(profile),
    expectedSettingsDigest,
  };
}
