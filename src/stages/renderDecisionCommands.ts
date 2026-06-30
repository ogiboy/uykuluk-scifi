export const renderDecisionValues = [
  "accepted-for-local-review",
  "needs-revision",
  "rejected",
] as const;

export type RenderDecision = (typeof renderDecisionValues)[number];

export const renderDecisionJsonPath = "production/render/render_decision.json";
export const renderDecisionMarkdownPath = "production/render/render_decision.md";

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
    command: renderShellCommand("pnpm", [
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

/**
 * Builds the default command template for recording an accepted local render decision.
 *
 * @param runId - The run identifier to include in the command.
 * @returns The render-decision command template for `runId`.
 */
export function renderDecisionNextAction(runId: string): string {
  return renderDecisionCommandTemplates(runId)[0].command;
}

/**
 * Builds the read-only command for reopening a recorded local render decision.
 *
 * @param runId - The run identifier to include in the command.
 * @returns The render-decision review command for `runId`.
 */
export function renderDecisionReviewCommand(runId: string): string {
  return renderShellCommand("pnpm", ["producer", "review", "render-decision", "--run", runId]);
}

const POSIX_SINGLE_QUOTE_ESCAPE = "'\"'\"'";

function renderShellCommand(binary: string, args: string[]): string {
  return [binary, ...args].map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", POSIX_SINGLE_QUOTE_ESCAPE)}'`;
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
