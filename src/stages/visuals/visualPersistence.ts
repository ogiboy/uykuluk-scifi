import { removeRunArtifact, writeRunJson, writeRunText } from "../../core/artifacts.js";
import type { RunRecord } from "../../core/state.js";
import { renderPlanArtifactPaths } from "../render/renderPlanSchemas.js";
import { renderVisualContactSheet } from "./visualContactSheet.js";
import {
  type VisualManifest,
  visualContactSheetPath,
  visualManifestPath,
} from "./visualContracts.js";

export const invalidatedVisualConsumers = [
  ...renderPlanArtifactPaths,
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
  "evidence_bundle.json",
  "evidence_bundle.md",
] as const;

export const visualMutationRollbackPaths = [
  visualManifestPath,
  visualContactSheetPath,
  ...invalidatedVisualConsumers,
] as const;

export async function persistVisualManifest(
  run: RunRecord,
  manifest: VisualManifest,
  stage: string,
): Promise<RunRecord> {
  let updated = await writeRunJson(run, stage, visualManifestPath, manifest);
  updated = await writeRunText(
    updated,
    stage,
    visualContactSheetPath,
    renderVisualContactSheet(manifest),
  );
  return updated;
}

export async function invalidateVisualConsumers(run: RunRecord, stage: string): Promise<RunRecord> {
  let updated = run;
  for (const relativePath of invalidatedVisualConsumers) {
    updated = await removeRunArtifact(updated, stage, relativePath);
  }
  return updated;
}
