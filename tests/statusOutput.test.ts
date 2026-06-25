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
        nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
        blockedActions: ["TTS disabled until configured and approved."],
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
    expect(output).toContain("Blocked actions: 1");
    expect(output).toContain("Next safe action: pnpm producer approve render --run <run_id>");
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

  it("recommends idea approval before evidence exists", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["ideas.json"],
      state: "IDEAS_GENERATED",
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Next safe action: pnpm producer approve idea --run <run_id> --idea <idea_id>",
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

    expect(output).toContain("Next safe action: pnpm producer script --run <run_id>");
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
