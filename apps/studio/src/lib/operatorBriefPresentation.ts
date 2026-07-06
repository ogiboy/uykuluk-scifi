import type { StudioRunPrimaryAction } from "./runPrimaryAction";

export type OperatorBriefControl = "copy-command" | "done" | "run-controls-link" | "stage-button";

/**
 * Chooses the visual control used by the Studio operator brief.
 *
 * This keeps web-ready stage actions from falling back to a CLI copy command just because the
 * underlying CLI equivalent is available for auditability.
 *
 * @param action - Primary action projected from CLI/core run state.
 * @returns The control family the operator brief should render.
 */
export function operatorBriefControlForAction(
  action: StudioRunPrimaryAction,
): OperatorBriefControl {
  if (action.mode === "stage") {
    return "stage-button";
  }
  if (action.mode === "rail") {
    return "run-controls-link";
  }
  if (action.mode === "command") {
    return "copy-command";
  }
  return "done";
}

/**
 * Formats the compact operator brief badge label for a primary action tone.
 *
 * @param tone - Primary action safety/presentation tone.
 * @returns Short badge copy for the Studio control desk.
 */
export function operatorBriefToneLabel(tone: StudioRunPrimaryAction["tone"]): string {
  if (tone === "available") {
    return "web-ready";
  }
  if (tone === "blocked") {
    return "blocked";
  }
  if (tone === "complete") {
    return "complete";
  }
  if (tone === "attention") {
    return "review";
  }
  return "CLI-only";
}
