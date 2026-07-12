export type StudioCliTerminationReason = "output-limit" | "timeout" | null;

export type BoundedStudioCliOutput = Readonly<{ exceeded: boolean; value: string }>;

/**
 * Appends a CLI output chunk without retaining data beyond the configured boundary.
 *
 * @param value - Output retained so far.
 * @param chunk - Newly received process output.
 * @param limit - Maximum number of retained characters.
 * @returns The bounded output and whether the limit was exceeded.
 */
export function appendBoundedStudioCliOutput(
  value: string,
  chunk: string,
  limit: number,
): BoundedStudioCliOutput {
  const remaining = Math.max(0, limit - value.length);
  if (chunk.length <= remaining) {
    return { exceeded: false, value: value + chunk };
  }
  return { exceeded: true, value: value + chunk.slice(0, remaining) };
}

/**
 * Maps a process close result to the Studio route's stable status contract.
 *
 * @param reason - A Studio-enforced termination reason, when present.
 * @param processStatus - The process exit status supplied by Node.
 * @returns A stable CLI result status.
 */
export function studioCliResultStatus(
  reason: StudioCliTerminationReason,
  processStatus: number | null,
): number {
  if (reason === "output-limit") {
    return 413;
  }
  if (reason === "timeout") {
    return 124;
  }
  return processStatus ?? 1;
}

/**
 * Maps an internal CLI result to a bounded HTTP status for the Studio route.
 *
 * @param cliStatus - Internal result status from the CLI process boundary.
 * @returns Conflict for producer blockers, payload-too-large for output caps, or gateway timeout.
 */
export function studioCliHttpStatus(cliStatus: number): 409 | 413 | 504 {
  if (cliStatus === 413) {
    return 413;
  }
  if (cliStatus === 124) {
    return 504;
  }
  return 409;
}
