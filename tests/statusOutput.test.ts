import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import {
  blockedRenderedEvidence,
  manualProductionEvidence,
  passingRenderedEvidence,
} from "./statusOutputEvidenceFixtures";

describe("operator status output", () => {
  useTempProject();

  it("summarizes run state, approvals, warnings, artifacts, and next safe action", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      state: "READY_FOR_MANUAL_PRODUCTION",
      approvals: [
        {
          approvalId: "approval_status_script",
          runId: run.runId,
          target: "script",
          approvedRef: "script-digest",
          previousState: "SCRIPT_REVIEWED",
          nextState: "SCRIPT_APPROVED",
          approvingCommand: "producer approve script",
          createdAt: "2026-06-23T00:00:00.000Z",
        },
      ],
      artifacts: ["production/render_plan.json", "evidence_bundle.json"],
      warnings: ["needs fact check"],
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(manualProductionEvidence(run.runId)),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(`Run: ${run.runId}`);
    expect(output).toContain("State: READY_FOR_MANUAL_PRODUCTION");
    expect(output).toContain("Approvals: 1");
    expect(output).toContain("Warnings: 1");
    expect(output).toContain("Artifacts: 2");
    expect(output).toContain("Blocked actions: 2");
    expect(output).toContain("Blocked action details:");
    expect(output).toContain(
      `- Render plan not generated; run pnpm producer render-plan --run ${run.runId} before TTS/render work.`,
    );
    expect(output).toContain("- TTS disabled until configured and approved.");
    expect(output).toContain(
      "Next safe action: Manual production review. Enable local TTS before draft render.",
    );
    expect(output).toContain("Production media:");
    expect(output).toContain("- Render plan: pass");
    expect(output).toContain(
      `  Review: Review with pnpm producer review render-plan --run ${run.runId}; confirm scene-to-asset mapping, bookend/source-frame paths, and the contact sheet before voiceover or render approval.`,
    );
    expect(output).toContain("- Voiceover audio: missing");
    expect(output).toContain(
      "  Review: Generate and review local voiceover from the CLI before render approval.",
    );
    expect(output).toContain("- Draft render: missing");
    expect(output).toContain(
      "  Review: Approve and run the local draft render from the CLI only after current plan and voiceover evidence pass.",
    );
    expect(output).toContain("Recent artifacts:");
    expect(output).toContain("- evidence_bundle.json");
    expect((await loadRun(run.runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });

  it("keeps early workflow guidance when no evidence bundle exists", async () => {
    const run = await createRun();

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Next safe action: pnpm producer ideas");
    expect(output).toContain("Evidence: missing");
  });

  it("uses evidence statuses for production media when evidence is available", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: [
        "production/render_plan.json",
        "production/audio/voiceover.wav",
        "production/render/draft.mp4",
        "evidence_bundle.json",
      ],
      state: "RENDERED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(blockedRenderedEvidence(run.runId)),
      "utf8",
    );

    const status = await readRunStatus(run.runId);
    const output = formatRunStatus(status);

    expect(output).toContain("Production media:");
    expect(output).toContain("- Render plan: pass");
    expect(output).toContain("- Voiceover audio: pass");
    expect(output).toContain("- Draft render: block");
    expect(output).toContain(
      "  Review: Resolve the blocker from the CLI before approving, rendering, uploading, or publishing.",
    );
    expect(output).toContain(
      `Next safe action: Regenerate evidence with pnpm producer evidence --run ${run.runId}; if draft artifacts remain blocked, revise upstream artifacts before a new render approval.`,
    );
  });

  it("includes production media evidence details when artifacts pass", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: [
        "production/render_plan.json",
        "production/audio/voiceover.wav",
        "production/render/draft.mp4",
        "evidence_bundle.json",
      ],
      state: "RENDERED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(passingRenderedEvidence(run.runId)),
      "utf8",
    );

    const status = await readRunStatus(run.runId);
    const output = formatRunStatus(status);

    expect(output).toContain("- Render plan: pass (11 assets, 3 artifacts)");
    expect(output).toContain(
      "- Voiceover audio: pass (8s, local-piper, production voice candidate, 42 source words)",
    );
    expect(output).toContain(
      `  Review: Review with pnpm producer review voice --run ${run.runId}; listen to runs/${run.runId}/production/audio/voiceover.wav and verify pronunciation, pacing, and tone before render approval.`,
    );
    expect(status.mediaArtifacts[1]?.reviewArtifactPath).toBe(
      "production/audio/voiceover_review.md",
    );
    expect(output).toContain(
      "- Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover local-piper production candidate, approval approval_render_status, ffprobe 1280x720 audio)",
    );
    expect(status.mediaArtifacts[2]?.localPlaybackPath).toBe(
      `runs/${run.runId}/production/render/draft.mp4`,
    );
    expect(status.mediaArtifacts[2]?.reviewArtifactPath).toBe("production/render/draft_review.md");
    expect(output).toContain(
      `  Review: Review with pnpm producer review render --run ${run.runId}; upload and publish remain disabled.`,
    );
    expect(output).toContain(`Next safe action: pnpm producer review render --run ${run.runId}`);
  });

  it("recommends idea approval before evidence exists", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["ideas.json"],
      state: "IDEAS_GENERATED",
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      `Next safe action: pnpm producer approve idea --run ${run.runId} --idea <idea_id>`,
    );
    expect(output).toContain("Evidence: missing");
  });

  it("recommends script retry after an approved idea when evidence is missing", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/script_generation_failure.json"),
      JSON.stringify({
        runId: run.runId,
        stage: "script",
        state: "IDEA_APPROVED",
        providerMode: "ollama",
        model: "qwen3:8b",
        thinkingMode: "no_think",
        failureKind: "below_long_form_floor",
        message:
          "Invalid script continuation chunk 1 provider response: continuation has no complete sentence.",
        nextAction: `Try a stronger or larger local script model, or raise providers.llm.maxOutputTokens.script in producer.config.json, then rerun pnpm producer script --run ${run.runId}.`,
        requiredWordCount: 1500,
        wordCount: 999,
        createdAt: "2026-06-25T00:00:00.000Z",
      }),
      "utf8",
    );
    await saveRun({
      ...run,
      approvedIdeaId: "idea_001",
      artifacts: ["ideas.json", "diagnostics/script_generation_failure.json"],
      state: "IDEA_APPROVED",
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(`Next safe action: pnpm producer script --run ${run.runId}`);
    expect(output).toContain("Diagnostics:");
    expect(output).toContain(
      "- diagnostics/script_generation_failure.json [script]: Invalid script continuation chunk 1 provider response: continuation has no complete sentence. (below_long_form_floor: 999/1500 words)",
    );
    expect(output).toContain(
      `Next action: Try a stronger or larger local script model, or raise providers.llm.maxOutputTokens.script in producer.config.json, then rerun pnpm producer script --run ${run.runId}.`,
    );
    expect(output).toContain("Evidence: missing");
  });

  it("surfaces idea generation diagnostics while keeping the run in the new state", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/ideas_generation_failure.json"),
      JSON.stringify({
        runId: run.runId,
        stage: "ideas",
        state: "NEW",
        providerMode: "ollama",
        model: "qwen3:8b",
        thinkingMode: "no_think",
        message:
          "Invalid ideas provider response after repair attempt: ideas.3.fit: Fit explanations reuse a repeated sentence frame.",
        createdAt: "2026-06-25T00:00:00.000Z",
      }),
      "utf8",
    );
    await saveRun({
      ...run,
      artifacts: ["diagnostics/ideas_generation_failure.json"],
      state: "NEW",
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Next safe action: pnpm producer ideas");
    expect(output).toContain("Diagnostics:");
    expect(output).toContain(
      "- diagnostics/ideas_generation_failure.json [ideas]: Invalid ideas provider response after repair attempt: ideas.3.fit: Fit explanations reuse a repeated sentence frame.",
    );
    expect(output).toContain("Evidence: missing");
    expect((await loadRun(run.runId)).state).toBe("NEW");
  });
});
