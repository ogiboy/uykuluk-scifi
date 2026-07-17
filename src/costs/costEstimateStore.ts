import { createHash } from "node:crypto";

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

/**
 * Loads and verifies the active cost quote from the specified producer project root.
 *
 * @param projectRoot - The producer project root containing the quote artifacts
 * @param run - The run record whose registered artifacts define the evidence available for loading
 * @returns The validated cost estimate, persisted text, and canonical digest
 * @throws SafeExitError If the active JSON or Markdown artifact is missing, malformed, or inconsistent
 */
export async function readCostEstimateAtProjectRoot(
  projectRoot: string,
  run: Pick<RunRecord, "runId" | "artifacts">,
): Promise<LoadedCostEstimate> {
  const [jsonBytes, markdownBytes] = await Promise.all([
    readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, "costs/estimate.json"),
    readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, "costs/estimate.md"),
  ]);
  if (!jsonBytes || !markdownBytes) {
    throw new SafeExitError("Active cost quote artifacts are missing.");
  }
  return parseCostEstimateBytes(jsonBytes, markdownBytes);
}

/**
 * Resolves an approved cost quote by verifying its canonical digest against active or archived evidence.
 *
 * @param projectRoot - The project root containing the registered cost quote artifacts
 * @param run - The run record whose registered artifacts identify eligible quote evidence
 * @param expectedDigest - The canonical digest of the required JSON/Markdown quote pair
 * @returns The verified cost estimate, source texts, and computed digest
 * @throws SafeExitError If the digest is unavailable or archived bytes do not match their canonical digest path
 */
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

/**
 * Validates a persisted cost quote and its deterministic Markdown representation.
 *
 * @param jsonBytes - The serialized cost quote JSON bytes.
 * @param markdownBytes - The persisted Markdown rendering of the cost quote.
 * @returns The validated estimate, decoded source texts, and canonical digest.
 * @throws `SafeExitError` if the JSON is malformed or invalid, or if the Markdown does not match the quote.
 */
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
