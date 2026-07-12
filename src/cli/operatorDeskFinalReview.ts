import type { FinalReviewBundleStatus } from "../stages/finalReview/finalReviewBundleStatus.js";

/**
 * Summarizes final-review bundle status for operator desk compact rows.
 *
 * @param bundle - The final-review bundle status.
 * @returns A short display status.
 */
export function finalReviewBundleSummary(bundle: FinalReviewBundleStatus): string {
  if (bundle.kind === "present") {
    return bundle.bundle.status;
  }
  return bundle.kind;
}

/**
 * Formats final-review bundle detail lines for the operator desk.
 *
 * @param bundle - The final-review bundle status.
 * @returns Operator-facing detail lines.
 */
export function finalReviewBundleLines(bundle: FinalReviewBundleStatus): string[] {
  if (bundle.kind === "present") {
    return [
      `Final review bundle artifact: ${bundle.reviewPath}`,
      `Final review bundle next action: ${bundle.nextAction}`,
    ];
  }
  if (bundle.kind === "missing") {
    return bundle.nextAction ? [`Final review bundle next action: ${bundle.nextAction}`] : [];
  }
  return [
    `Final review bundle issue: ${bundle.message}`,
    `Final review bundle next action: ${bundle.nextAction}`,
  ];
}
