import type { RunState } from "../../../../src/core/state";

export type StudioRunState = RunState;

export type RunRecord = {
  approvals?: unknown[];
  artifacts?: string[];
  createdAt?: string;
  runId?: string;
  state?: StudioRunState;
  updatedAt?: string;
  warnings?: string[];
};
