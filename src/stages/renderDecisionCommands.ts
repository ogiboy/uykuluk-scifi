import { shellCommand } from "../utils/shell.js";
import { renderDecisionValues, type RenderDecision } from "./renderDecision.js";

export type RenderDecisionCommandTemplate = {
  command: string;
  decision: RenderDecision;
  guidance: string;
};

/**
 * Builds copy-pasteable local render-decision command templates.
 *
 * @param runId - The rendered run that the operator reviewed.
 * @returns Decision command templates for every allowed local render-review outcome.
 */
export function renderDecisionCommandTemplates(runId: string): RenderDecisionCommandTemplate[] {
  return renderDecisionValues.map((decision) => ({
    command: shellCommand("pnpm", [
      "producer",
      "decide",
      "render",
      "--run",
      runId,
      "--decision",
      decision,
      "--notes",
      "<operator notes>",
      "--reviewed-by",
      "operator",
    ]),
    decision,
    guidance: decisionGuidance(decision),
  }));
}

function decisionGuidance(decision: RenderDecision): string {
  switch (decision) {
    case "accepted-for-local-review":
      return "Use only after watching the complete local draft and confirming it is ready for manual channel review.";
    case "needs-revision":
      return "Use when the draft is directionally useful but upstream package, voiceover, subtitles, timing, or visual assets need another pass.";
    case "rejected":
      return "Use when this draft should not be used for channel review or upload preparation.";
  }
}
