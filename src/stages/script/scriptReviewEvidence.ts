import { artifactPath } from "../../core/artifacts.js";
import { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";

export async function readScriptReviewEvidence(
  run: RunRecord,
): Promise<{ scriptReviewWarningCount: number; scriptReviewBlockerCount: number }> {
  const relativePath = "reviews/script_review.json";
  if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
    return { scriptReviewWarningCount: 0, scriptReviewBlockerCount: 0 };
  }
  const review = await readJsonFile<{
    warningCount?: number;
    blockerCount?: number;
    warnings?: Array<{ severity?: string }>;
  }>(artifactPath(run.runId, relativePath));
  return {
    scriptReviewWarningCount: review.warningCount ?? review.warnings?.length ?? 0,
    scriptReviewBlockerCount:
      review.blockerCount ??
      review.warnings?.filter((warning) => warning.severity === "blocker").length ??
      0,
  };
}
