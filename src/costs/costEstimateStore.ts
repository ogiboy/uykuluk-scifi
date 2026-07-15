import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { artifactPathAtProjectRoot } from "../core/artifactPaths.js";
import { readRegisteredArtifactBytesAtProjectRoot } from "../core/artifactRevision.js";
import { SafeExitError } from "../core/errors.js";
import type { RunRecord } from "../core/state.js";
import { costEstimateSchema, type CostEstimate } from "./costEstimateContracts.js";
import { renderCostEstimateMarkdown } from "./costEstimatePresentation.js";

export type LoadedCostEstimate = Readonly<{
  estimate: CostEstimate;
  text: string;
  markdownText: string;
  digest: string;
}>;

/** Reads and verifies the active quote beneath an explicit producer project root. */
export async function readCostEstimateAtProjectRoot(
  projectRoot: string,
  runId: string,
): Promise<LoadedCostEstimate> {
  const [jsonBytes, markdownBytes] = await Promise.all([
    readFile(artifactPathAtProjectRoot(projectRoot, runId, "costs/estimate.json")),
    readFile(artifactPathAtProjectRoot(projectRoot, runId, "costs/estimate.md")),
  ]);
  return parseCostEstimateBytes(jsonBytes, markdownBytes);
}

/** Resolves an exact active or archived registered quote by its JSON/Markdown pair digest. */
export async function readCostEstimateByDigestAtProjectRoot(
  projectRoot: string,
  run: RunRecord,
  expectedDigest: string,
): Promise<LoadedCostEstimate> {
  const candidates = ["costs/estimate.json", `costs/quotes/${expectedDigest}/estimate.json`].filter(
    (relativePath) => run.artifacts.includes(relativePath),
  );
  for (const jsonPath of candidates) {
    const markdownPath = jsonPath.replace(/estimate\.json$/, "estimate.md");
    if (!run.artifacts.includes(markdownPath)) continue;
    const [jsonBytes, markdownBytes] = await Promise.all([
      readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, jsonPath),
      readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, markdownPath),
    ]);
    if (!jsonBytes || !markdownBytes) continue;
    const loaded = parseCostEstimateBytes(jsonBytes, markdownBytes);
    if (loaded.digest === expectedDigest) return loaded;
    if (jsonPath !== "costs/estimate.json") {
      throw new SafeExitError(
        "Archived cost quote bytes do not match their canonical digest path.",
      );
    }
  }
  throw new SafeExitError(
    "Approved cost quote digest is not available in active or archived evidence.",
  );
}

function parseCostEstimateBytes(jsonBytes: Buffer, markdownBytes: Buffer): LoadedCostEstimate {
  const text = jsonBytes.toString("utf8");
  const markdownText = markdownBytes.toString("utf8");
  let estimate: CostEstimate;
  try {
    estimate = costEstimateSchema.parse(JSON.parse(text) as unknown);
  } catch {
    throw new SafeExitError("Cost quote JSON is malformed or invalid.");
  }
  const expectedMarkdown = `${renderCostEstimateMarkdown(estimate)}\n`;
  if (markdownText !== expectedMarkdown) {
    throw new SafeExitError("Cost quote Markdown does not match the persisted JSON quote.");
  }
  return { estimate, text, markdownText, digest: quoteDigest(jsonBytes, markdownBytes) };
}

function quoteDigest(jsonBytes: Buffer, markdownBytes: Buffer): string {
  return createHash("sha256")
    .update(Buffer.concat([jsonBytes, Buffer.from([0]), markdownBytes]))
    .digest("hex");
}
