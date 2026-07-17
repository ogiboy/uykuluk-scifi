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
  });
});
