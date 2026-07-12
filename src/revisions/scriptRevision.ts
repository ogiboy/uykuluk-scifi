import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun, setRunState } from "../core/runStore.js";
import { runStateSchema } from "../core/state.js";
import { assertTransition } from "../core/transitions.js";
import { extractClaims, extractVisualBeats } from "../stages/script/scriptMetaExtractors.js";
import type { ScriptMeta } from "../stages/types.js";
import { pathExists } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { countSpokenNarrationWords } from "../utils/scriptProductionText.js";
import { createId, nowIso } from "../utils/time.js";

const revisableStates = ["SCRIPT_GENERATED", "SCRIPT_REVIEWED", "SCRIPT_APPROVED"] as const;

const scriptRevisionSchema = z.strictObject({
  revisionId: z.string().min(1),
  runId: z.string().min(1),
  artifact: z.literal("script.md"),
  editor: z.string().min(1),
  reason: z.string().min(1),
  previousState: runStateSchema,
  nextState: z.literal("SCRIPT_GENERATED"),
  beforeHash: z.string().length(64),
  afterHash: z.string().length(64),
  invalidatedApprovalIds: z.array(z.string()),
  invalidatedArtifacts: z.array(z.string()),
  invalidatedWarnings: z.array(z.string()),
  refreshedArtifacts: z.array(z.string()),
  createdAt: z.iso.datetime(),
});

const scriptMetaSchema = z.strictObject({
  estimatedDuration: z.string().min(1),
  wordCount: z.int().nonnegative(),
  narrationWordCount: z.int().nonnegative().optional(),
  tone: z.string().min(1),
  claimsRequiringFactCheck: z.array(z.string()),
  possibleVisualBeats: z.array(z.string()),
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokensApprox: z.number().nonnegative().optional(),
  outputTokensApprox: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative(),
  sectionCount: z.int().positive(),
  prompt: z.strictObject({
    key: z.string().min(1),
    hash: z.string().length(64),
    artifact: z.string().min(1),
    source: z.string().min(1).optional(),
  }),
});

export type ScriptRevision = z.infer<typeof scriptRevisionSchema>;

/**
 * Revises the script for a run, invalidating related approvals and artifacts.
 *
 * Validates that the run is in a revisable state and that the provided reason, editor, and content are non-empty.
 * Creates a revision record capturing before and after script states, invalidates approvals targeting the script,
 * removes artifacts derived from script review, and clears warnings. Updates the run state to `SCRIPT_GENERATED`.
 *
 * @returns The created script revision
 */
export async function reviseScript(input: {
  runId: string;
  content: string;
  reason: string;
  editor: string;
}): Promise<ScriptRevision> {
  let run = await loadRun(input.runId);
  const stage = "revise-script";
  if (!revisableStates.includes(run.state as (typeof revisableStates)[number])) {
    await blockRevision(
      run.runId,
      `Script revision requires state ${revisableStates.join(", ")}; current state is ${run.state}.`,
      { currentState: run.state, allowedStates: revisableStates },
    );
  }
  const reason = input.reason.trim();
  const editor = input.editor.trim();
  if (!reason || !editor) {
    await blockRevision(run.runId, "Script revision requires a non-empty reason and editor.");
  }
  if (!input.content.trim()) {
    await blockRevision(run.runId, "Revised script cannot be empty.");
  }

  const before = await readFile(artifactPath(run.runId, "script.md"), "utf8");
  const { meta: beforeMeta, text: beforeMetaText } = await readRequiredScriptMeta(run.runId);
  const after = input.content.endsWith("\n") ? input.content : `${input.content}\n`;
  const beforeHash = sha256(before);
  const afterHash = sha256(after);
  if (beforeHash === afterHash) {
    await blockRevision(run.runId, "Revised script must be different from the active script.");
  }

  const revisionId = createId("revision");
  const revisionDir = `revisions/script/${revisionId}`;
  const invalidatedApprovalIds = run.approvals
    .filter((approval) => approval.target === "script")
    .map((approval) => approval.approvalId);
  const invalidatedArtifacts = run.artifacts.filter(isDerivedFromScriptReview);
  const refreshedArtifacts = ["script.meta.json"];
  const afterMeta = refreshScriptMeta(beforeMeta, after);
  const revision = scriptRevisionSchema.parse({
    revisionId,
    runId: run.runId,
    artifact: "script.md",
    editor,
    reason,
    previousState: run.state,
    nextState: "SCRIPT_GENERATED",
    beforeHash,
    afterHash,
    invalidatedApprovalIds,
    invalidatedArtifacts,
    invalidatedWarnings: run.warnings,
    refreshedArtifacts,
    createdAt: nowIso(),
  });

  run = await writeRunText(run, stage, `${revisionDir}/before.md`, before);
  run = await writeRunText(run, stage, `${revisionDir}/after.md`, after);
  run = await writeRunText(run, stage, `${revisionDir}/before.meta.json`, beforeMetaText);
  run = await writeRunJson(run, stage, `${revisionDir}/after.meta.json`, afterMeta);
  for (const relativePath of invalidatedArtifacts.filter((item) => item.startsWith("reviews/"))) {
    const target = artifactPath(run.runId, relativePath);
    if (await pathExists(target)) {
      run = await writeRunText(
        run,
        stage,
        `${revisionDir}/invalidated/${stripReviewsPrefix(relativePath)}`,
        await readFile(target, "utf8"),
      );
    }
  }
  run = await writeRunJson(run, stage, `${revisionDir}/revision.json`, revision);
  run = await writeRunText(run, stage, "script.md", after);
  run = await writeRunJson(run, stage, "script.meta.json", afterMeta);
  run = {
    ...run,
    approvals: run.approvals.filter((approval) => approval.target !== "script"),
    artifacts: run.artifacts.filter((relativePath) => !isDerivedFromScriptReview(relativePath)),
    warnings: [],
  };
  if (run.state === "SCRIPT_GENERATED") {
    await saveRun(run);
  } else {
    assertTransition(run.state, "SCRIPT_GENERATED");
    run = await setRunState(run, "SCRIPT_GENERATED", stage);
  }
  await appendLedgerEvent({
    runId: run.runId,
    type: "ARTIFACT_REVISED",
    stage,
    message: `Revised script.md as ${revisionId}.`,
    data: revision,
  });
  return revision;
}

async function readRequiredScriptMeta(runId: string): Promise<{ meta: ScriptMeta; text: string }> {
  try {
    const text = await readFile(artifactPath(runId, "script.meta.json"), "utf8");
    return { text, meta: scriptMetaSchema.parse(JSON.parse(text)) as ScriptMeta };
  } catch {
    return blockRevision(
      runId,
      "Script revision requires a valid script.meta.json; regenerate the script before revising.",
    );
  }
}

function refreshScriptMeta(meta: ScriptMeta, script: string): ScriptMeta {
  const wordCount = script.trim().split(/\s+/u).filter(Boolean).length;
  const narrationWordCount = countSpokenNarrationWords(script);
  return {
    ...meta,
    estimatedDuration: `${Math.max(1, Math.round(narrationWordCount / 135))}-${Math.max(2, Math.round(narrationWordCount / 115))} dakika`,
    wordCount,
    narrationWordCount,
    claimsRequiringFactCheck: extractClaims(script),
    possibleVisualBeats: extractVisualBeats(script),
  };
}

function stripReviewsPrefix(relativePath: string): string {
  const prefix = "reviews/";
  return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath;
}

/**
 * Determines if an artifact path is derived from a script review.
 *
 * @param relativePath - The artifact path to evaluate
 * @returns `true` if the path matches patterns indicating script review derivation, `false` otherwise
 */
function isDerivedFromScriptReview(relativePath: string): boolean {
  return (
    relativePath.startsWith("reviews/") ||
    relativePath === "evidence_bundle.json" ||
    relativePath === "evidence_bundle.md" ||
    relativePath.startsWith("diagnostics/readiness.")
  );
}

/**
 * Blocks a script revision by recording a guard event to the ledger and throwing an error.
 *
 * @param runId - The ID of the run being revised
 * @param message - The reason for blocking the revision
 * @param data - Optional additional context to include in the ledger event
 */
async function blockRevision(runId: string, message: string, data?: unknown): Promise<never> {
  await appendLedgerEvent({ runId, type: "GUARD_BLOCKED", stage: "revise-script", message, data });
  throw new SafeExitError(`Blocked: ${message}`);
}
