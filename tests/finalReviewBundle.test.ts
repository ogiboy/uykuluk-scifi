import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  createFinalReviewBundle,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  type FinalReviewBundle,
} from "../src/stages/finalReviewBundle";
import { recordRenderDecision, renderDecisionArtifactPaths } from "../src/stages/renderDecision";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";
import { renderLocalDraft } from "./renderPipelineHelpers";

describe("local final review bundle", () => {
  useTempProject();

  it("creates a decision-pending local review handoff after draft render", async () => {
    const runId = await renderLocalDraft("final-review-pending");

    const bundle = await createFinalReviewBundle(runId);

    expect(bundle).toMatchObject({
      runId,
      schemaVersion: 3,
      status: "decision-pending",
      renderDecision: { kind: "missing", nextAction: expect.stringContaining(`--run ${runId}`) },
      draftRender: {
        chapters: {
          jsonPath: "production/render/youtube_chapters.json",
          markdownPath: "production/render/youtube_chapters.md",
        },
        path: "production/render/draft.mp4",
        reviewPath: "production/render/draft_review.md",
        manifestPath: "production/render/render_manifest.json",
        media: { audioCodec: "aac", videoCodec: "h264", width: 1280, height: 720 },
      },
      voiceover: { path: "production/audio/voiceover.wav", productionVoiceCandidate: false },
      media: {
        soundtrack: {
          manifestPath: "production/audio/soundtrack/manifest.json",
          manifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          mode: "voice-only",
          decision: { status: "approved" },
        },
        rightsProvenance: { assetCount: 0, musicAssetCount: 0, sfxAssetCount: 0, rightsBases: [] },
        mastering: {
          evidencePath: "production/render/audio_mastering.json",
          evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          target: { integratedLufs: -14, maxOutputTruePeakDbtp: -1, loudnessRangeLufs: 11 },
          output: { integratedLufs: -14, truePeakDbtp: -1.2, loudnessRangeLufs: 5 },
          passed: true,
        },
        encoding: {
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "aac",
          audioSampleRateHz: 48_000,
          audioChannels: 2,
        },
        renderApproval: { contractVersion: 4 },
      },
    });
    expect(bundle.artifacts.map((artifact) => artifact.path)).toEqual(
      expect.arrayContaining([
        "script.md",
        "production/production_package.md",
        "production/storyboard_contact_sheet.md",
        "production/audio/voiceover_review.md",
        "production/render/draft.mp4",
        "production/render/draft_review.md",
        "production/render/youtube_chapters.md",
        "production/render/youtube_chapters.json",
        "evidence_bundle.md",
        "diagnostics/readiness.md",
      ]),
    );
    expect(bundle.nextSafeAction).toContain("producer decide render");
    expect(bundle.blockedActions.join(" ").toLowerCase()).toContain("upload");

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([finalReviewBundleJsonPath, finalReviewBundleMarkdownPath]),
    );
    const markdown = await readFile(artifactPath(runId, finalReviewBundleMarkdownPath), "utf8");
    expect(markdown).toContain("# Local Final Review Handoff");
    expect(markdown).toContain("production/render/draft_review.md");
    expect(markdown).toContain("production/render/youtube_chapters.md");
    expect(markdown).toContain("Timestamped map");
    expect(markdown).toContain("Decision: pending");
    expect(markdown).toContain("## Soundtrack, Rights, and Mastering");
    expect(markdown).toContain("Mastered output");
    expect(markdown).toContain("Render approval");
    expect(markdown.toLowerCase()).toContain("upload");
    expect(markdown.toLowerCase()).toContain("publish");
  });

  it("includes a trusted recorded render decision when one exists", async () => {
    const runId = await renderLocalDraft("final-review-accepted");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable for local channel review.",
      reviewedBy: "operator",
      runId,
    });

    const bundle = await createFinalReviewBundle(runId);

    expect(bundle).toMatchObject({
      status: "accepted-for-local-review",
      renderDecision: {
        kind: "present",
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
        reviewCommand: `pnpm producer review render-decision --run ${runId}`,
      },
      nextSafeAction: expect.stringContaining(`pnpm producer channel-handoff --run ${runId}`),
    });
    expect(bundle.artifacts.map((artifact) => artifact.path)).toContain(
      "production/render/render_decision.md",
    );
    const markdown = await readFile(artifactPath(runId, finalReviewBundleMarkdownPath), "utf8");
    expect(markdown).toContain("Decision: accepted-for-local-review");
    expect(markdown).toContain("Draft is acceptable for local channel review.");
  });

  it("fails closed instead of bundling stale render-decision evidence", async () => {
    const runId = await renderLocalDraft("final-review-stale-decision");
    const decision = await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable.",
      reviewedBy: "operator",
      runId,
    });
    await writeFile(
      renderDecisionArtifactPaths(runId).json,
      JSON.stringify({
        ...decision,
        draftRender: { ...decision.draftRender, sha256: "f".repeat(64) },
      }),
      "utf8",
    );

    await expect(createFinalReviewBundle(runId)).rejects.toThrow(/different draft render digest/);
  });

  it("requires the approved soundtrack still bound to v11 render evidence", async () => {
    const runId = await renderLocalDraft("final-review-soundtrack-binding");
    await writeFile(artifactPath(runId, "production/audio/soundtrack/manifest.json"), "{}", "utf8");

    await expect(createFinalReviewBundle(runId)).rejects.toThrow(
      /soundtrack manifest does not match manifest evidence/i,
    );
  });

  it("treats legacy schema v1 final-review bundles as stale instead of invalid", async () => {
    const runId = await renderLocalDraft("final-review-legacy");
    const bundle = await createFinalReviewBundle(runId);
    await writeFile(
      artifactPath(runId, finalReviewBundleJsonPath),
      JSON.stringify({
        ...bundle,
        draftRender: { ...bundle.draftRender, chapters: undefined },
        schemaVersion: 1,
      }),
      "utf8",
    );

    const status = await readRunStatus(runId);

    expect(status.finalReviewBundle).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("legacy schema version 1"),
    });
  });

  it("keeps v2 bundles readable as stale regeneration inputs", async () => {
    const runId = await renderLocalDraft("final-review-v2-legacy");
    const bundle = await createFinalReviewBundle(runId);
    const { media: _media, ...v2Bundle } = bundle;
    await writeFile(
      artifactPath(runId, finalReviewBundleJsonPath),
      JSON.stringify({ ...v2Bundle, schemaVersion: 2 }),
      "utf8",
    );

    const status = await readRunStatus(runId);

    expect(status.finalReviewBundle).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("legacy schema version 2"),
      nextAction: expect.stringContaining(`--run ${runId}`),
    });
  });

  it("prints parseable CLI JSON and persists the bundle artifacts", async () => {
    const runId = await renderLocalDraft("final-review-cli");

    const result = runCli(["review-bundle", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    const bundle = JSON.parse(result.stdout) as FinalReviewBundle;
    expect(bundle).toMatchObject({
      runId,
      status: "decision-pending",
      draftRender: { path: "production/render/draft.mp4" },
    });
    await expect(
      readFile(artifactPath(runId, finalReviewBundleJsonPath), "utf8"),
    ).resolves.toContain('"status": "decision-pending"');
  });

  it("surfaces the ready final review handoff in status and operator desk output", async () => {
    const runId = await renderLocalDraft("final-review-status");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable for local channel review.",
      reviewedBy: "operator",
      runId,
    });
    await createFinalReviewBundle(runId);

    const status = await readRunStatus(runId);
    const statusOutput = formatRunStatus(status);
    const deskOutput = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId }));

    expect(status.finalReviewBundle).toMatchObject({
      kind: "present",
      bundle: { status: "accepted-for-local-review" },
      reviewPath: "production/review_bundle.md",
    });
    expect(status.nextRecommendedCommand).toContain(`pnpm producer channel-handoff --run ${runId}`);
    expect(status.nextRecommendedCommand).not.toContain("producer review-bundle");
    expect(statusOutput).toContain("Final review bundle: accepted-for-local-review");
    expect(statusOutput).toContain("Final review bundle artifact: production/review_bundle.md");
    expect(deskOutput).toContain("Final review bundle: accepted-for-local-review");
    expect(deskOutput).toContain("Final review bundle artifact: production/review_bundle.md");
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}
