import type { FinalReviewBundleStatus } from "../finalReview/finalReviewBundleStatus.js";

/**
 * Formats final-review bundle status lines for the operator status report.
 *
 * @param bundle - The current final-review bundle status.
 * @returns Status lines for the final-review bundle section.
 */
export function formatFinalReviewBundleStatus(bundle: FinalReviewBundleStatus): string[] {
  if (bundle.kind === "missing") {
    return bundle.nextAction
      ? ["Final review bundle: missing", `Final review bundle next action: ${bundle.nextAction}`]
      : ["Final review bundle: not applicable"];
  }
  if (bundle.kind === "present") {
    return [
      `Final review bundle: ${bundle.bundle.status}`,
      `Final review bundle artifact: ${bundle.reviewPath}`,
      `Final review bundle next action: ${bundle.nextAction}`,
    ];
  }
  return [
    `Final review bundle: ${bundle.kind} (${bundle.message})`,
    `Final review bundle next action: ${bundle.nextAction}`,
  ];
}
