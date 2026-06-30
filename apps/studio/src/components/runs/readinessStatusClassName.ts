/**
 * Maps a readiness status to its status pill class name.
 *
 * @param status - The readiness status value
 * @returns The CSS class name for the corresponding status pill
 */
export function readinessStatusClassName(status: string): string {
  if (status === "block") {
    return "status-pill small blocked";
  }
  return "status-pill small";
}
