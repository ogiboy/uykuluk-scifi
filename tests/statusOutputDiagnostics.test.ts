import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";

describe("operator status diagnostics", () => {
  useTempProject();

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
