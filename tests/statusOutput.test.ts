import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";

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
      JSON.stringify({
        currentState: "READY_FOR_MANUAL_PRODUCTION",
        runId: run.runId,
        nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
        blockedActions: [
          "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work.",
          "TTS disabled until configured and approved.",
        ],
      }),
      "utf8",
    );

    const status = await readRunStatus(run.runId);
    const output = formatRunStatus(status);

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
    expect(output).toContain(`Next safe action: pnpm producer approve render --run ${run.runId}`);
    expect(output).toContain("Production media:");
    expect(output).toContain("- Render plan: recorded");
    expect(output).toContain("- Voiceover audio: missing");
    expect(output).toContain("- Draft render: missing");
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
      JSON.stringify({
        currentState: "RENDERED",
        draftRender: { status: "block", message: "Draft render output does not match manifest." },
        nextRecommendedCommand:
          "Regenerate evidence; draft render artifacts are missing or blocked.",
        renderPlan: { status: "pass" },
        runId: run.runId,
        voiceoverAudio: { status: "pass" },
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Production media:");
    expect(output).toContain("- Render plan: pass");
    expect(output).toContain("- Voiceover audio: pass");
    expect(output).toContain("- Draft render: block");
    expect(output).toContain(
      "Next safe action: Regenerate evidence; draft render artifacts are missing or blocked.",
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
      JSON.stringify({
        blockedActions: [],
        currentState: "RENDERED",
        draftRender: {
          status: "pass",
          durationSeconds: 8.2,
          mediaProbe: {
            audio: { codecName: "aac" },
            video: { height: 720, width: 1280 },
          },
          sourceFrameCount: 4,
          sourceFrameSegments: ["intro:2", "outro:2"],
          timelineSegments: ["intro", "scene", "outro"],
        },
        nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
        renderPlan: { status: "pass", artifactCount: 3, assetCount: 11 },
        runId: run.runId,
        voiceoverAudio: {
          status: "pass",
          durationSeconds: 8.2,
          mode: "local-piper",
          productionVoiceCandidate: true,
          sourceWordCount: 42,
        },
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("- Render plan: pass (11 assets, 3 artifacts)");
    expect(output).toContain(
      "- Voiceover audio: pass (8s, local-piper, production voice candidate, 42 source words)",
    );
    expect(output).toContain(
      "- Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, ffprobe 1280x720 audio)",
    );
    expect(output).toContain(
      "Next safe action: Manual final draft review. Upload remains approval-gated.",
    );
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
        message:
          "Invalid script continuation chunk 1 provider response: continuation has no complete sentence.",
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
      "- diagnostics/script_generation_failure.json [script]: Invalid script continuation chunk 1 provider response: continuation has no complete sentence.",
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
