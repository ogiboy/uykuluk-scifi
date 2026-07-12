import { createHash } from "node:crypto";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  artifactPath,
  recordRunArtifact,
  removeRunArtifact,
  writeRunJson,
} from "../core/artifacts.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import {
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
} from "../stages/channel/channelHandoffContracts.js";
import {
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
} from "../stages/channel/channelHandoffDecisionContracts.js";
import {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
} from "../stages/finalReview/finalReviewBundleContracts.js";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../stages/render/renderDecisionCommands.js";
import { draftRenderArtifactPaths, draftRenderPath } from "../stages/renderEvidence.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { createId, nowIso } from "../utils/time.js";
import {
  resolveRenderRevisionEvidence,
  type RenderRevisionRecoveryOptions,
} from "./renderRevisionEvidence.js";
import { blockRenderRevision } from "./renderRevisionGuard.js";

const requiredRenderRevisionArtifacts = [...draftRenderArtifactPaths] as const;

const derivedRenderRevisionArtifacts = [
  "evidence_bundle.json",
  "evidence_bundle.md",
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
] as const;

const renderRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revisionId: z.string().min(1),
  runId: z.string().min(1),
  previousState: z.literal("RENDERED"),
  nextState: z.literal("READY_FOR_MANUAL_PRODUCTION"),
  decision: z.enum(["needs-revision", "rejected", "invalid-evidence"]),
  decisionCreatedAt: z.iso.datetime(),
  decisionReviewedBy: z.string().min(1),
  reason: z.string().min(1),
  draftRenderSha256: z.string().regex(/^[a-f0-9]{64}$/),
  invalidatedApprovalIds: z.array(z.string().min(1)).min(1),
  archivedArtifacts: z.array(
    z.strictObject({ sourcePath: z.string().min(1), archivedPath: z.string().min(1) }),
  ),
  removedArtifacts: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
});

export type RenderRevision = z.infer<typeof renderRevisionSchema>;

export type RenderRevisionOptions = RenderRevisionRecoveryOptions;

/**
 * Archives a rejected local draft and returns the run to the explicit render-approval gate.
 *
 * The operator must first record a `needs-revision` or `rejected` render decision. The active
 * draft, decision, and downstream evidence are then preserved under a versioned revision path,
 * the stale render approval is invalidated, and a fresh approval is required before rerendering.
 *
 * @param runId - The rendered run to prepare for another local draft.
 * @param options - Explicit recovery attribution when current decision evidence is invalid.
 * @returns Durable render-revision evidence and archived artifact locations.
 */
export async function reviseRender(
  runId: string,
  options: RenderRevisionOptions = {},
): Promise<RenderRevision> {
  let run = await loadRun(runId);
  const stage = "revise-render";
  if (run.state !== "RENDERED") {
    return blockRenderRevision(
      run.runId,
      `Render revision requires state RENDERED; current state is ${run.state}.`,
    );
  }
  assertTransition(run.state, "READY_FOR_MANUAL_PRODUCTION");

  const approval = run.approvals.find((item) => item.target === "render");
  if (!approval?.approvedRef) {
    return blockRenderRevision(
      run.runId,
      "Render revision requires the active digest-bound render approval.",
    );
  }
  await assertRequiredArtifacts(run.runId, run.artifacts);
  const draftBytes = await readFile(artifactPath(run.runId, draftRenderPath));
  const draftRenderSha256 = createHash("sha256").update(draftBytes).digest("hex");
  const evidence = await resolveRenderRevisionEvidence(
    run,
    approval.approvalId,
    approval.approvedRef,
    draftRenderSha256,
    options,
  );

  const revisionId = createId("revision");
  const revisionDir = `revisions/render/${revisionId}`;
  const sourceArtifacts: string[] = [];
  for (const relativePath of new Set([
    ...requiredRenderRevisionArtifacts,
    ...derivedRenderRevisionArtifacts,
  ])) {
    if (
      run.artifacts.includes(relativePath) ||
      (await pathExists(artifactPath(run.runId, relativePath)))
    ) {
      sourceArtifacts.push(relativePath);
    }
  }
  const existingArtifacts: string[] = [];
  for (const sourcePath of sourceArtifacts) {
    if (await pathExists(artifactPath(run.runId, sourcePath))) {
      existingArtifacts.push(sourcePath);
    }
  }
  const archivedArtifacts = existingArtifacts.map((sourcePath) => ({
    sourcePath,
    archivedPath: `${revisionDir}/invalidated/${sourcePath}`,
  }));
  for (const artifact of archivedArtifacts) {
    const destination = artifactPath(run.runId, artifact.archivedPath);
    await ensureDir(path.dirname(destination));
    await copyFile(artifactPath(run.runId, artifact.sourcePath), destination);
    run = await recordRunArtifact(run, stage, artifact.archivedPath);
  }
  for (const sourcePath of sourceArtifacts) {
    run = await removeRunArtifact(run, stage, sourcePath);
  }

  const invalidatedApprovalIds = [approval.approvalId];
  run = { ...run, approvals: run.approvals.filter((item) => item.target !== "render") };
  const revision = renderRevisionSchema.parse({
    schemaVersion: 1,
    revisionId,
    runId: run.runId,
    previousState: "RENDERED",
    nextState: "READY_FOR_MANUAL_PRODUCTION",
    decision: evidence.decision,
    decisionCreatedAt: evidence.createdAt,
    decisionReviewedBy: evidence.reviewedBy,
    reason: evidence.reason,
    draftRenderSha256,
    invalidatedApprovalIds,
    archivedArtifacts,
    removedArtifacts: sourceArtifacts.filter((item) => !existingArtifacts.includes(item)),
    createdAt: nowIso(),
  });
  run = await writeRunJson(run, stage, `${revisionDir}/revision.json`, revision);
  run = await setRunState(run, "READY_FOR_MANUAL_PRODUCTION", stage);
  await appendLedgerEvent({
    runId: run.runId,
    type: "ARTIFACT_REVISED",
    stage,
    message: `Archived rejected draft render as ${revisionId}; fresh render approval required.`,
    data: revision,
  });
  return revision;
}

async function assertRequiredArtifacts(runId: string, artifacts: string[]): Promise<void> {
  for (const relativePath of requiredRenderRevisionArtifacts) {
    if (
      !artifacts.includes(relativePath) ||
      !(await pathExists(artifactPath(runId, relativePath)))
    ) {
      await blockRenderRevision(
        runId,
        `Render revision requires the active artifact ${relativePath}.`,
      );
    }
  }
}
