import { readFile } from "node:fs/promises";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { reviewScriptContent } from "../safeguards/contentGuard.js";
import { sha256 } from "../utils/hash.js";
import { bulletList } from "../utils/markdown.js";

/**
 * Reviews the generated script content for a run.
 *
 * @returns An object containing the warnings produced by the content review.
 */
export async function reviewScript(
  runId: string,
): Promise<{ warnings: ReturnType<typeof reviewScriptContent> }> {
  let run = await loadRun(runId);
  await requireState(run, "SCRIPT_GENERATED", "review-script");
  assertTransition(run.state, "SCRIPT_REVIEWED");
  try {
    const script = await readFile(artifactPath(run.runId, "script.md"), "utf8");
    const warnings = reviewScriptContent(script);
    const review = {
      runId: run.runId,
      scriptHash: sha256(script),
      warningCount: warnings.length,
      blockerCount: warnings.filter((warning) => warning.severity === "blocker").length,
      warnings,
    };
    run = {
      ...run,
      warnings: Array.from(
        new Set([...run.warnings, ...warnings.map((warning) => warning.message)]),
      ),
    };
    run = await writeRunJson(run, "review-script", "reviews/script_review.json", review);
    run = await writeRunText(
      run,
      "review-script",
      "reviews/script_review.md",
      [
        "# Script Review",
        "",
        "## Warnings",
        "",
        bulletList(
          warnings.map((warning) => `[${warning.severity}] ${warning.code}: ${warning.message}`),
        ),
      ].join("\n"),
    );
    await setRunState(run, "SCRIPT_REVIEWED", "review-script");
    return { warnings };
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "review-script",
      message: (error as Error).message,
    });
    throw error;
  }
}
