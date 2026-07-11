import { runReviewHref, type RunReviewTab } from "./runReviewNavigation";

type MutationReviewTarget = Readonly<{ fragment?: string; label: string; tab: RunReviewTab }>;

const mutationReviewTargets: Readonly<Record<string, MutationReviewTarget>> = {
  "analytics.import": target("progress", "Open affected run"),
  "analytics.report": target("progress", "Open affected run"),
  "channel-handoff.decide": target("handoff", "Open handoff review"),
  "channel-handoff.run": target("handoff", "Open handoff review"),
  "cost.approve": target("readiness", "Open readiness and action rail", "review-decision"),
  "doctor.run": target("progress", "Open affected run"),
  "estimate.run": target("readiness", "Open readiness review"),
  "evidence.run": target("readiness", "Open evidence and readiness review"),
  "idea.approve": target("progress", "Open action rail", "review-decision"),
  "ideas.run": target("progress", "Open idea approval rail", "review-decision"),
  "package.run": target("artifacts", "Open package artifacts"),
  "package-artifact.revise": target("artifacts", "Open revised artifacts", "review-decision"),
  "readiness.run": target("readiness", "Open readiness review"),
  "render.approve": target("media", "Open render approval rail", "review-decision"),
  "render.decide": target("handoff", "Open handoff review", "review-decision"),
  "render.review": target("media", "Open media review"),
  "render.run": target("media", "Open draft render review"),
  "render-plan.review": target("artifacts", "Open render plan artifacts"),
  "render-plan.run": target("artifacts", "Open render plan artifacts"),
  "review-bundle.run": target("handoff", "Open final review bundle"),
  "script.approve": target("progress", "Open action rail", "review-decision"),
  "script.review": target("artifacts", "Open script review artifacts"),
  "script.revise": target("artifacts", "Open revised script", "review-decision"),
  "script.run": target("artifacts", "Open generated script"),
  "voice.review": target("media", "Open voiceover review"),
  "voice.run": target("media", "Open voiceover media"),
};

/**
 * Builds the most useful run-review link after a guarded Studio mutation completes.
 *
 * @param runId - The affected persisted run id.
 * @param actionId - The guarded Studio action id that produced the result.
 * @returns A run-detail href focused on the review tab most likely to show the new evidence.
 */
export function studioMutationResultHref(runId: string, actionId: string): string {
  const reviewTarget = mutationReviewTarget(actionId);
  return runReviewHref(runId, reviewTarget.tab, reviewTarget.fragment);
}

/**
 * Describes where the mutation result link will take the operator.
 *
 * @param actionId - The guarded Studio action id that produced the result.
 * @returns Concise link text for the result target.
 */
export function studioMutationResultLinkLabel(actionId: string): string {
  return mutationReviewTarget(actionId).label;
}

function mutationReviewTarget(actionId: string): MutationReviewTarget {
  return mutationReviewTargets[actionId] ?? target("progress", "Open affected run");
}

function target(tab: RunReviewTab, label: string, fragment?: string): MutationReviewTarget {
  return { fragment, label, tab };
}
