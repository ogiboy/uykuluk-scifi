import { readFile, readdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig, loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import {
  promptProfileDigest,
  selectPromptProfile,
} from "../src/prompts/profiles/promptProfileStore";
import { configDigest } from "../src/settings/settingsRevisionStore";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";

describe("episode brief idea generation", () => {
  useTempProject();

  it("persists the exact settings, profile, and operator brief used by the ideas operation", async () => {
    const profile = selectPromptProfile("science-space", defaultConfig.editorial.profiles);
    const expectedSettingsDigest = configDigest(await loadConfig());
    const { runId } = await runIdeas({
      profileId: profile.id,
      expectedProfileDigest: promptProfileDigest(profile),
      expectedSettingsDigest,
      operatorBrief: "Europa okyanusundaki yaşam arayışını bilimsel belirsizlikleriyle ele al.",
    });

    const settings = JSON.parse(
      await readFile(artifactPath(runId, "operation/ideas.settings.json"), "utf8"),
    ) as { config: typeof defaultConfig; profile: typeof profile; digest: string };
    const brief = JSON.parse(await readFile(artifactPath(runId, "episode/brief.json"), "utf8")) as {
      operatorBrief: string;
      operationSettingsDigest: string;
      profileId: string;
    };
    const ideas = JSON.parse(await readFile(artifactPath(runId, "ideas.json"), "utf8")) as {
      prompt: { hash: string };
    };

    expect(settings.config.studio.locale).toBe("tr");
    expect(settings.profile).toEqual(profile);
    expect(brief).toMatchObject({
      operatorBrief: "Europa okyanusundaki yaşam arayışını bilimsel belirsizlikleriyle ele al.",
      operationSettingsDigest: settings.digest,
      profileId: "science-space",
    });
    expect(ideas.prompt.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects stale profile submissions before creating a run", async () => {
    const expectedSettingsDigest = configDigest(await loadConfig());
    await expect(
      runIdeas({
        profileId: "sci-fi",
        expectedProfileDigest: "0".repeat(64),
        expectedSettingsDigest,
      }),
    ).rejects.toThrow("Prompt profile changed");

    await expect(readdir("runs")).resolves.toEqual([]);
  });

  it("rejects stale settings submissions before creating a run", async () => {
    const profile = selectPromptProfile("sci-fi", defaultConfig.editorial.profiles);
    await expect(
      runIdeas({
        profileId: profile.id,
        expectedProfileDigest: promptProfileDigest(profile),
        expectedSettingsDigest: "0".repeat(64),
      }),
    ).rejects.toThrow("Settings changed before idea generation");

    await expect(readdir("runs")).resolves.toEqual([]);
  });

  it("requires an operator brief for the custom profile", async () => {
    const profile = selectPromptProfile("custom-brief", defaultConfig.editorial.profiles);
    const expectedSettingsDigest = configDigest(await loadConfig());

    await expect(
      runIdeas({
        profileId: profile.id,
        expectedProfileDigest: promptProfileDigest(profile),
        expectedSettingsDigest,
      }),
    ).rejects.toThrow("operator brief");
  });

  it("keeps a completed operation pinned after project settings change", async () => {
    const profile = selectPromptProfile("technology", defaultConfig.editorial.profiles);
    const expectedSettingsDigest = configDigest(await loadConfig());
    const { runId } = await runIdeas({
      profileId: profile.id,
      expectedProfileDigest: promptProfileDigest(profile),
      expectedSettingsDigest,
      operatorBrief: "Kuantum ağların pratik sınırları",
    });
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            llm: { ...defaultConfig.providers.llm, model: "changed-after-operation" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const settings = JSON.parse(
      await readFile(artifactPath(runId, "operation/ideas.settings.json"), "utf8"),
    ) as { config: typeof defaultConfig };
    expect(settings.config.providers.llm.model).toBe(defaultConfig.providers.llm.model);
  });
});
