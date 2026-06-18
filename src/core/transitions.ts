import { SafeExitError } from "./errors";
import { RunState } from "./state";

const allowedTransitions: Record<RunState, RunState[]> = {
  NEW: ["IDEAS_GENERATED", "FAILED"],
  IDEAS_GENERATED: ["IDEA_APPROVED", "FAILED"],
  IDEA_APPROVED: ["SCRIPT_GENERATED", "FAILED"],
  SCRIPT_GENERATED: ["SCRIPT_REVIEWED", "FAILED"],
  SCRIPT_REVIEWED: ["SCRIPT_GENERATED", "SCRIPT_APPROVED", "FAILED"],
  SCRIPT_APPROVED: ["SCRIPT_GENERATED", "PRODUCTION_PACKAGE_GENERATED", "FAILED"],
  PRODUCTION_PACKAGE_GENERATED: ["COST_ESTIMATED", "FAILED"],
  COST_ESTIMATED: ["READY_FOR_MANUAL_PRODUCTION", "FAILED"],
  READY_FOR_MANUAL_PRODUCTION: ["RENDER_APPROVED", "UPLOAD_APPROVED", "ARCHIVED", "FAILED"],
  RENDER_APPROVED: ["RENDERED", "FAILED"],
  RENDERED: ["UPLOAD_APPROVED", "FAILED"],
  UPLOAD_APPROVED: ["UPLOADED_PRIVATE", "FAILED"],
  UPLOADED_PRIVATE: ["PUBLISH_APPROVED", "ARCHIVED", "FAILED"],
  PUBLISH_APPROVED: ["SCHEDULED_OR_PUBLIC", "FAILED"],
  SCHEDULED_OR_PUBLIC: ["ARCHIVED", "FAILED"],
  ARCHIVED: [],
  FAILED: ["ARCHIVED"],
};

export function canTransition(from: RunState, to: RunState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) {
    throw new SafeExitError(`Transition blocked: ${from} -> ${to}`);
  }
}
