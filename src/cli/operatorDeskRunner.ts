import { renderOperatorDesk } from "./operatorDeskInk.js";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "./operatorDeskModel.js";

export type RunOperatorDeskOptions = { latest?: boolean; plain?: boolean; run?: string };

/**
 * Runs the operator desk in interactive Ink mode or plain text mode.
 *
 * @param options - CLI options that control the output mode and selected run.
 */
export async function runOperatorDesk(options: RunOperatorDeskOptions): Promise<void> {
  const model = await buildOperatorDeskViewModel({ latest: options.latest, runId: options.run });
  if (shouldUsePlainOperatorDeskOutput(options)) {
    console.log(formatOperatorDeskPlain(model));
    return;
  }
  await renderOperatorDesk(model);
}

/**
 * Decides whether the operator desk should use non-interactive plain output.
 *
 * @param options - CLI options that control output mode.
 * @param streams - Optional stream TTY state for tests.
 * @returns `true` when Ink should not be mounted.
 */
export function shouldUsePlainOperatorDeskOutput(
  options: Pick<RunOperatorDeskOptions, "plain">,
  streams?: { stdinIsTTY?: boolean; stdoutIsTTY?: boolean },
): boolean {
  const ttyState = streams ?? {
    stdinIsTTY: process.stdin.isTTY,
    stdoutIsTTY: process.stdout.isTTY,
  };
  return options.plain === true || ttyState.stdoutIsTTY !== true || ttyState.stdinIsTTY !== true;
}
