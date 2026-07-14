import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const voiceSdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));
const initialElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: voiceSdk.convertWithTimestamps };
  },
}));

import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { generateVoiceoverAudio } from "../src/stages/voice";
import {
  approvedHostedVoiceConfirmation,
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
  workflowFixtureWav,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";

describe("Studio voice audition evidence", () => {
  useTempProject();

  afterEach(() => {
    voiceSdk.convertWithTimestamps.mockReset();
    if (initialElevenLabsApiKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = initialElevenLabsApiKey;
  });

  it("keeps Studio readiness equal to canonical local voice evidence", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const paths = {
      meta: "production/audio/voiceover.meta.json",
      review: "production/audio/voiceover_review.md",
      scenes: "production/scenes.json",
      source: "production/voiceover.txt",
    } as const;
    const originals = Object.fromEntries(
      await Promise.all(
        Object.entries(paths).map(async ([key, relativePath]) => [
          key,
          await readFile(artifactPath(runId, relativePath)),
        ]),
      ),
    ) as Record<keyof typeof paths, Buffer>;

    await rm(artifactPath(runId, paths.review));
    await expectStudioVoiceUnavailable(runId, /voiceover_review\.md|artifact registration/i);
    await writeFile(artifactPath(runId, paths.review), originals.review);

    const staleRenderPlanMeta = JSON.parse(originals.meta.toString("utf8")) as {
      renderPlan: { digest: string };
    };
    staleRenderPlanMeta.renderPlan.digest = "f".repeat(64);
    await writeFile(
      artifactPath(runId, paths.meta),
      `${JSON.stringify(staleRenderPlanMeta, null, 2)}\n`,
      "utf8",
    );
    await expectStudioVoiceUnavailable(runId, /stale or missing render plan/i);

    const legacyLocalMeta = JSON.parse(originals.meta.toString("utf8")) as Record<string, unknown>;
    legacyLocalMeta.schemaVersion = 1;
    delete legacyLocalMeta.normalizedAlignment;
    delete legacyLocalMeta.subtitle;
    await writeFile(
      artifactPath(runId, paths.meta),
      `${JSON.stringify(legacyLocalMeta, null, 2)}\n`,
      "utf8",
    );
    expect((await getStudioRunDetail(runId))?.voiceAudition.production.synthesis).toMatchObject({
      mode: "deterministic-local",
      status: "ready",
    });

    await writeFile(
      artifactPath(runId, paths.source),
      Buffer.concat([originals.source, Buffer.from("\nTampered source\n")]),
    );
    await expectStudioVoiceUnavailable(runId, /source text digest.*metadata/i);
    await writeFile(artifactPath(runId, paths.source), originals.source);

    await writeFile(
      artifactPath(runId, paths.scenes),
      Buffer.concat([originals.scenes, Buffer.from("\n")]),
    );
    await expectStudioVoiceUnavailable(runId, /stale or missing render plan|production package/i);
  });

  it("blocks missing or tampered hosted audio, subtitle, alignment, and legacy v1 evidence", async () => {
    const runId = await prepareHostedProductionVoice();
    const paths = {
      alignment: "production/audio/alignment.json",
      audio: "production/audio/voiceover.wav",
      meta: "production/audio/voiceover.meta.json",
      subtitle: "production/audio/subtitles.aligned.srt",
    } as const;
    const originals = Object.fromEntries(
      await Promise.all(
        Object.entries(paths).map(async ([key, relativePath]) => [
          key,
          await readFile(artifactPath(runId, relativePath)),
        ]),
      ),
    ) as Record<keyof typeof paths, Buffer>;

    expect((await readStudioDetailFromDifferentCwd(runId))?.voiceAudition.production).toMatchObject(
      { alignment: { status: "ready" }, synthesis: { mode: "elevenlabs", status: "ready" } },
    );

    await rm(artifactPath(runId, paths.audio));
    expect((await getStudioRunDetail(runId))?.voiceAudition.production.synthesis.status).toBe(
      "missing",
    );
    await writeFile(artifactPath(runId, paths.audio), originals.audio);

    await writeFile(
      artifactPath(runId, paths.subtitle),
      Buffer.concat([originals.subtitle, Buffer.from("\nTampered subtitle\n")]),
    );
    expect((await getStudioRunDetail(runId))?.voiceAudition.production.synthesis.status).toBe(
      "missing",
    );
    await writeFile(artifactPath(runId, paths.subtitle), originals.subtitle);

    await writeFile(
      artifactPath(runId, paths.alignment),
      Buffer.concat([originals.alignment, Buffer.from("\n")]),
    );
    expect((await getStudioRunDetail(runId))?.voiceAudition.production.alignment.status).toBe(
      "missing",
    );
    await writeFile(artifactPath(runId, paths.alignment), originals.alignment);

    const reservationsPath = artifactPath(runId, "costs/reservations.jsonl");
    const reservations = await readFile(reservationsPath, "utf8");
    const unsettledReservations = reservations
      .split("\n")
      .filter(Boolean)
      .filter((line) => (JSON.parse(line) as { type?: string }).type !== "SETTLED")
      .join("\n");
    await writeFile(reservationsPath, `${unsettledReservations}\n`, "utf8");
    await expectStudioVoiceUnavailable(runId, /reservation or settlement evidence/i);
    await writeFile(reservationsPath, reservations, "utf8");

    const legacyMeta = JSON.parse(originals.meta.toString("utf8")) as Record<string, unknown>;
    legacyMeta.schemaVersion = 1;
    delete legacyMeta.normalizedAlignment;
    delete legacyMeta.subtitle;
    await writeFile(
      artifactPath(runId, paths.meta),
      `${JSON.stringify(legacyMeta, null, 2)}\n`,
      "utf8",
    );
    const legacyDetail = await getStudioRunDetail(runId);
    expect(legacyDetail?.voiceAudition.production.synthesis.status).toBe("missing");
    expect(legacyDetail?.voiceAudition.advanced.diagnostics.join(" ")).toMatch(
      /Legacy ElevenLabs voice|Legacy hosted voice/,
    );
  });
});

async function prepareHostedProductionVoice(): Promise<string> {
  process.env.ELEVENLABS_API_KEY = "studio-voice-evidence-test-key";
  voiceSdk.convertWithTimestamps.mockImplementation((_voiceId, request) => {
    const characters = Array.from(request.text as string);
    const durationSeconds = Math.max(1, characters.length / 14);
    return {
      withRawResponse: async () => ({
        data: {
          audioBase64: workflowFixtureWav(Math.ceil(durationSeconds)).toString("base64"),
          alignment: fixtureAlignment(characters, durationSeconds),
          normalizedAlignment: fixtureAlignment(characters, durationSeconds),
        },
        rawResponse: {
          headers: new Headers({
            "character-cost": String(characters.length),
            "request-id": "studio-voice-evidence-request",
          }),
        },
      }),
    };
  });
  const { runId } = await prepareApprovedSelectedVoiceRun();
  await generateVoiceoverAudio(runId, {
    confirmation: await approvedHostedVoiceConfirmation(runId),
    metadataProvider: successfulExecutionMetadataProvider({ subscription: paidVoiceSubscription }),
  });
  return runId;
}

function fixtureAlignment(characters: string[], durationSeconds: number) {
  return {
    characters,
    characterStartTimesSeconds: characters.map(
      (_, index) => (index / characters.length) * durationSeconds,
    ),
    characterEndTimesSeconds: characters.map(
      (_, index) => ((index + 1) / characters.length) * durationSeconds,
    ),
  };
}

async function expectStudioVoiceUnavailable(runId: string, diagnostic: RegExp): Promise<void> {
  const detail = await getStudioRunDetail(runId);
  expect(detail?.voiceAudition.production).toMatchObject({
    alignment: { status: "missing" },
    synthesis: { status: "missing" },
  });
  expect(detail?.voiceAudition.advanced.diagnostics.join(" ")).toMatch(diagnostic);
}

async function readStudioDetailFromDifferentCwd(runId: string) {
  const root = process.cwd();
  const outside = await mkdtemp(path.join(tmpdir(), "uykulukscifi-studio-cwd-"));
  const previousConfiguredRoot = process.env.UYKULUK_SCIFI_ROOT;
  try {
    process.env.UYKULUK_SCIFI_ROOT = root;
    process.chdir(outside);
    return await getStudioRunDetail(runId);
  } finally {
    process.chdir(root);
    if (previousConfiguredRoot === undefined) delete process.env.UYKULUK_SCIFI_ROOT;
    else process.env.UYKULUK_SCIFI_ROOT = previousConfiguredRoot;
    await rm(outside, { recursive: true, force: true });
  }
}
