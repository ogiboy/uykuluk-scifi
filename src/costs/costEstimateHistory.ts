import { artifactPathAtProjectRoot } from "../core/artifactPaths.js";
import { recordRunArtifact, removeRunArtifact } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { writeBinaryFile } from "../utils/fs.js";
import {
  readCostEstimateAtProjectRoot,
  readCostEstimateByDigestAtProjectRoot,
  type LoadedCostEstimate,
} from "./costEstimateStore.js";

export type ArchivedCostEstimate = Readonly<{
  digest: string;
  jsonPath: string;
  markdownPath: string;
}>;

/** Archives the active exact quote pair and removes only its active aliases. */
export async function archiveActiveCostEstimate(input: {
  projectRoot?: string;
  run: RunRecord;
  stage: string;
}): Promise<{ run: RunRecord; quote: LoadedCostEstimate; archive: ArchivedCostEstimate }> {
  const projectRoot = input.projectRoot ?? process.cwd();
  const quote = await readCostEstimateAtProjectRoot(projectRoot, input.run);
  const archive = costEstimateArchivePaths(quote.digest);
  let run = input.run;
  await writeBinaryFile(
    artifactPathAtProjectRoot(projectRoot, run.runId, archive.jsonPath),
    Buffer.from(quote.text, "utf8"),
  );
  run = await recordRunArtifact(run, input.stage, archive.jsonPath);
  await writeBinaryFile(
    artifactPathAtProjectRoot(projectRoot, run.runId, archive.markdownPath),
    Buffer.from(quote.markdownText, "utf8"),
  );
  run = await recordRunArtifact(run, input.stage, archive.markdownPath);
  run = await removeRunArtifact(run, input.stage, "costs/estimate.json");
  run = await removeRunArtifact(run, input.stage, "costs/estimate.md");
  await readCostEstimateByDigestAtProjectRoot(projectRoot, run, quote.digest);
  return { run, quote, archive };
}

export function costEstimateArchivePaths(digest: string): ArchivedCostEstimate {
  return {
    digest,
    jsonPath: `costs/quotes/${digest}/estimate.json`,
    markdownPath: `costs/quotes/${digest}/estimate.md`,
  };
}
