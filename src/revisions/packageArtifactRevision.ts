import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath, removeRunArtifact, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { runStateSchema } from "../core/state.js";
import { productionSceneSchema, renderPlanArtifactPaths } from "../stages/renderPlanSchemas.js";
import {
  createProductionPackageManifest,
  productionPackageArtifactPaths,
  productionPackageManifestPath,
  providerEvidenceFromManifest,
  verifyProductionPackage,
} from "../stages/productionPackageIntegrity.js";
import { sha256 } from "../utils/hash.js";
import { createId, nowIso } from "../utils/time.js";

const packageRevisionArtifactKeys = [
  "subtitles",
  "scenes",
  "popup-cards",
  "youtube-metadata",
] as const;

const packageRevisionArtifactKeySchema = z.enum(packageRevisionArtifactKeys);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const youtubeMetadataSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)),
});
const scenesArtifactSchema = z.strictObject({
  scenes: z.array(productionSceneSchema).min(1),
});
const packageRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revisionId: z.string().min(1),
  runId: z.string().min(1),
  artifactKey: packageRevisionArtifactKeySchema,
  artifactPath: z.enum(productionPackageArtifactPaths),
  editor: z.string().min(1),
  reason: z.string().min(1),
  previousState: runStateSchema,
  beforeHash: digestSchema,
  afterHash: digestSchema,
  previousManifestDigest: digestSchema,
  nextManifestDigest: digestSchema,
  invalidatedArtifacts: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
});

export type PackageRevisionArtifactKey = z.infer<typeof packageRevisionArtifactKeySchema>;
export type PackageArtifactRevision = z.infer<typeof packageRevisionSchema>;

const revisionTargets = {
  subtitles: "production/subtitles.srt",
  scenes: "production/scenes.json",
  "popup-cards": "production/production_package.md",
  "youtube-metadata": "production/youtube_metadata.json",
} as const satisfies Record<
  PackageRevisionArtifactKey,
  (typeof productionPackageArtifactPaths)[number]
>;

const invalidatedAfterPackageRevision = new Set<string>([
  ...renderPlanArtifactPaths,
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
  "evidence_bundle.json",
  "evidence_bundle.md",
]);

/**
 * Revises one generated production-package artifact with attribution and manifest refresh.
 *
 * Package revisions are intentionally limited to the immediate post-package state so later cost,
 * render-plan, voiceover, render, upload, or publish decisions cannot silently survive the edit.
 *
 * @param input - Revision content and attribution.
 * @returns The persisted revision event.
 */
export async function revisePackageArtifact(input: {
  runId: string;
  artifactKey: string;
  content: string;
  reason: string;
  editor: string;
}): Promise<PackageArtifactRevision> {
  let run = await loadRun(input.runId);
  const stage = "revise-package-artifact";
  if (run.state !== "PRODUCTION_PACKAGE_GENERATED") {
    await blockRevision(
      run.runId,
      `Package artifact revision requires state PRODUCTION_PACKAGE_GENERATED; current state is ${run.state}.`,
      { currentState: run.state },
    );
  }
  const artifactKeyResult = packageRevisionArtifactKeySchema.safeParse(input.artifactKey);
  let artifactKey: PackageRevisionArtifactKey;
  if (artifactKeyResult.success) {
    artifactKey = artifactKeyResult.data;
  } else {
    return await blockRevision(
      run.runId,
      `Unknown package artifact revision target. Use one of: ${packageRevisionArtifactKeys.join(", ")}.`,
    );
  }
  const reason = input.reason.trim();
  const editor = input.editor.trim();
  if (!reason || !editor) {
    await blockRevision(
      run.runId,
      "Package artifact revision requires a non-empty reason and editor.",
    );
  }
  const { manifest, digest: previousManifestDigest } = await verifyProductionPackage(run);
  const artifact = revisionTargets[artifactKey];
  const before = await readFile(artifactPath(run.runId, artifact), "utf8");
  let after: string;
  try {
    after = normalizeRevisionContent(artifactKey, input.content);
  } catch (error) {
    return await blockRevision(
      run.runId,
      `Invalid ${artifactKey} revision content: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const beforeHash = sha256(before);
  const afterHash = sha256(after);
  if (beforeHash === afterHash) {
    await blockRevision(
      run.runId,
      "Revised package artifact must be different from the active artifact.",
    );
  }

  const revisionId = createId("revision");
  const revisionDir = `revisions/package/${revisionId}`;
  const invalidatedArtifacts = run.artifacts.filter((item) =>
    invalidatedAfterPackageRevision.has(item),
  );
  run = await writeRunText(run, stage, `${revisionDir}/before/${path.basename(artifact)}`, before);
  run = await writeRunText(run, stage, `${revisionDir}/after/${path.basename(artifact)}`, after);
  run = await writeRunText(run, stage, artifact, after);
  const nextManifest = await createProductionPackageManifest(
    run,
    manifest.approvedScriptDigest,
    providerEvidenceFromManifest(manifest),
  );
  run = await writeRunJson(run, stage, productionPackageManifestPath, nextManifest);
  const nextManifestDigest = sha256(
    await readFile(artifactPath(run.runId, productionPackageManifestPath), "utf8"),
  );
  for (const relativePath of invalidatedArtifacts) {
    run = await removeRunArtifact(run, stage, relativePath);
  }
  const revision = packageRevisionSchema.parse({
    schemaVersion: 1,
    revisionId,
    runId: run.runId,
    artifactKey,
    artifactPath: artifact,
    editor,
    reason,
    previousState: run.state,
    beforeHash,
    afterHash,
    previousManifestDigest,
    nextManifestDigest,
    invalidatedArtifacts,
    createdAt: nowIso(),
  });
  run = await writeRunJson(run, stage, `${revisionDir}/revision.json`, revision);
  await saveRun(run);
  await appendLedgerEvent({
    runId: run.runId,
    type: "ARTIFACT_REVISED",
    stage,
    message: `Revised ${artifact} as ${revisionId}.`,
    data: revision,
  });
  return revision;
}

function normalizeRevisionContent(
  artifactKey: PackageRevisionArtifactKey,
  content: string,
): string {
  if (!content.trim()) {
    throw new Error("content cannot be empty.");
  }
  if (artifactKey === "scenes") {
    return `${JSON.stringify(scenesArtifactSchema.parse(JSON.parse(content)), null, 2)}\n`;
  }
  if (artifactKey === "youtube-metadata") {
    return `${JSON.stringify(youtubeMetadataSchema.parse(JSON.parse(content)), null, 2)}\n`;
  }
  if (artifactKey === "subtitles" && !content.includes("-->")) {
    throw new Error("subtitles must include at least one SRT timing marker.");
  }
  if (artifactKey === "popup-cards" && !content.includes("## Popup Cards")) {
    throw new Error("production package markdown must preserve the Popup Cards section.");
  }
  return content.endsWith("\n") ? content : `${content}\n`;
}

async function blockRevision(runId: string, message: string, data?: unknown): Promise<never> {
  await appendLedgerEvent({
    runId,
    type: "GUARD_BLOCKED",
    stage: "revise-package-artifact",
    message,
    data,
  });
  throw new SafeExitError(`Blocked: ${message}`);
}
