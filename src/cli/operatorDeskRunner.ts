import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "./operatorDeskModel.js";
import { renderOperatorDesk } from "./operatorDeskInk.js";

export type RunOperatorDeskOptions = {
  latest?: boolean;
  plain?: boolean;
  run?: string;
};

/**
 * Runs the operator desk in interactive Ink mode or plain text mode.
 *
 * @param options - CLI options that control the output mode and selected run.
 */
export async function runOperatorDesk(options: RunOperatorDeskOptions): Promise<void> {
  const model = await buildOperatorDeskViewModel({
    latest: options.latest,
    runId: options.run,
  });
  if (options.plain || process.stdout.isTTY !== true) {
    console.log(formatOperatorDeskPlain(model));
    return;
  }
  await renderOperatorDesk(model);
}
