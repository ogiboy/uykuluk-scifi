import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as runElevenLabsSmoke } from "../apps/studio/src/app/actions/elevenlabs-smoke/route";
import { POST as createEpisode } from "../apps/studio/src/app/actions/episode-create/route";
import { POST as executeLocalModel } from "../apps/studio/src/app/actions/local-models-execute/route";
import { POST as prepareLocalModel } from "../apps/studio/src/app/actions/local-models-prepare/route";
import { POST as savePromptProfile } from "../apps/studio/src/app/actions/prompt-profiles-save/route";
import { POST as saveSettings } from "../apps/studio/src/app/actions/settings-save/route";
import { cliArgsForAction } from "../apps/studio/src/lib/mutations/studioCliMutationArgs";
import { defaultConfig } from "../src/config/config";
import { promptProfileDigest } from "../src/prompts/profiles/promptProfileStore";
import { configDigest } from "../src/settings/settingsRevisionStore";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";
import { studioJsonMutationRequest } from "./studioMutationRouteTestHelpers";

describe("Studio settings and episode actions", () => {
  const expectedCurrentDigest = configDigest(defaultConfig);
  const profile = defaultConfig.editorial.profiles[0]!;
  const expectedProfileDigest = promptProfileDigest(profile);
  const editableSettings = {
    studio: defaultConfig.studio,
    providers: {
      llm: defaultConfig.providers.llm,
      tts: defaultConfig.providers.tts,
      imageGeneration: defaultConfig.providers.imageGeneration,
    },
    budgets: defaultConfig.budgets,
  };

  it("accepts exact revision and episode snapshot payloads only", () => {
    const settings = {
      editor: "operator",
      expectedCurrentDigest,
      note: "Use Turkish as the default Studio locale.",
      settings: editableSettings,
    };
    const profileSave = {
      editor: "operator",
      expectedCurrentDigest,
      expectedProfileDigest,
      makeActive: true,
      note: "Tighten the science-fiction profile direction.",
      profile: {
        ...profile,
        generationPrompt: `${profile.generationPrompt}\nAvoid generic hooks.`,
      },
    };
    const episode = {
      expectedProfileDigest,
      expectedSettingsDigest: expectedCurrentDigest,
      operatorBrief: "Kara deliklerin yakınındaki zaman algısı.",
      profileId: profile.id,
    };
    const smoke = { text: "Kısa tanı.", voiceId: "voice_test" };

    expect(parseStudioMutationRequest("settings.save", settings)).toEqual(settings);
    expect(parseStudioMutationRequest("promptProfiles.save", profileSave)).toEqual(profileSave);
    expect(parseStudioMutationRequest("episodes.create", episode)).toEqual(episode);
    expect(parseStudioMutationRequest("providers.elevenlabs.smoke", smoke)).toEqual(smoke);
    expect(() => parseStudioMutationRequest("settings.save", { ...settings, extra: true })).toThrow(
      /Unrecognized key/,
    );
    expect(() =>
      parseStudioMutationRequest("promptProfiles.save", { ...profileSave, profile: {} }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("episodes.create", { profileId: profile.id }),
    ).toThrow();
  });

  it("passes each validated payload to the producer CLI through a temporary owner-only JSON file", async () => {
    const settings = {
      editor: "operator",
      expectedCurrentDigest,
      note: "Keep this revision attributable.",
      settings: editableSettings,
    };
    const profileSave = {
      editor: "operator",
      expectedCurrentDigest,
      expectedProfileDigest,
      makeActive: false,
      note: "Tune profile wording.",
      profile: { ...profile, generationPrompt: `${profile.generationPrompt}\nPrefer evidence.` },
    };
    const episode = {
      expectedProfileDigest,
      expectedSettingsDigest: expectedCurrentDigest,
      profileId: profile.id,
    };
    const smoke = { text: "Kısa tanı.", voiceId: "voice_test" };
    const localModelPreparation = {
      operation: "setup" as const,
      packageId: "mflux-flux2-klein-4b-q4" as const,
    };
    const localModelExecution = {
      approvedBy: "operator",
      bindingDigest: "a".repeat(64),
      confirmExecution: true as const,
      runId: "run_studio_local_model",
    };

    await expectTemporaryJsonArgs("settings.save", settings, ["settings", "save"]);
    await expectTemporaryJsonArgs("promptProfiles.save", profileSave, ["prompt-profiles", "save"]);
    await expectTemporaryJsonArgs("episodes.create", episode, ["episodes", "create"]);
    await expectTemporaryJsonArgs("providers.elevenlabs.smoke", smoke, [
      "provider-smoke",
      "elevenlabs",
    ]);
    await expectTemporaryJsonArgs("localModels.prepare", localModelPreparation, [
      "local-model",
      "prepare",
    ]);
    await expectTemporaryJsonArgs("localModels.execute", localModelExecution, [
      "local-model",
      "execute",
    ]);
  });

  it("keeps all new routes behind the existing same-origin session and action-header boundary", async () => {
    const invalidSettings = saveSettings(
      studioJsonMutationRequest(
        "/actions/settings-save",
        "settings.save",
        {},
        { actionHeader: "ideas.run" },
      ),
    );
    const missingSession = savePromptProfile(
      studioJsonMutationRequest(
        "/actions/prompt-profiles-save",
        "promptProfiles.save",
        {},
        { cookieToken: null, sessionToken: null },
      ),
    );
    const crossOrigin = createEpisode(
      studioJsonMutationRequest(
        "/actions/episode-create",
        "episodes.create",
        {},
        { origin: "https://attacker.example" },
      ),
    );
    const diagnosticHeaderMismatch = runElevenLabsSmoke(
      studioJsonMutationRequest(
        "/actions/elevenlabs-smoke",
        "providers.elevenlabs.smoke",
        {},
        { actionHeader: "doctor.run" },
      ),
    );
    const localModelHeaderMismatch = prepareLocalModel(
      studioJsonMutationRequest(
        "/actions/local-models-prepare",
        "localModels.prepare",
        {},
        { actionHeader: "localModels.execute" },
      ),
    );
    const localModelMissingSession = executeLocalModel(
      studioJsonMutationRequest(
        "/actions/local-models-execute",
        "localModels.execute",
        {},
        { cookieToken: null, sessionToken: null },
      ),
    );

    await expect(invalidSettings.then((response) => response.status)).resolves.toBe(403);
    await expect(missingSession.then((response) => response.status)).resolves.toBe(401);
    await expect(crossOrigin.then((response) => response.status)).resolves.toBe(403);
    await expect(diagnosticHeaderMismatch.then((response) => response.status)).resolves.toBe(403);
    await expect(localModelHeaderMismatch.then((response) => response.status)).resolves.toBe(403);
    await expect(localModelMissingSession.then((response) => response.status)).resolves.toBe(401);
  });
});

async function expectTemporaryJsonArgs(
  actionId: Parameters<typeof cliArgsForAction>[0],
  payload: unknown,
  command: readonly string[],
): Promise<void> {
  const prepared = await cliArgsForAction(actionId, payload);
  try {
    expect(prepared.args).toEqual([...command, "--file", expect.any(String), "--json"]);
    const filePath = prepared.args[3]!;
    await expect(stat(filePath).then((file) => file.mode & 0o777)).resolves.toBe(0o600);
    await expect(
      readFile(filePath, "utf8").then((content) => JSON.parse(content)),
    ).resolves.toEqual(payload);
  } finally {
    await prepared.cleanup();
  }
}
