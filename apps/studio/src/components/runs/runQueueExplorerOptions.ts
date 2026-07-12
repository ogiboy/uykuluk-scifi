import type { RunQueueFilter } from "@/lib/runs/runQueueFilters";
import type { RunQueueDensity, RunQueueSort } from "@/lib/runs/runQueueWorkbench";

export const filterLabels = {
  all: "All",
  attention: "Needs attention",
  ready: "Ready evidence",
  rendered: "Rendered",
  decision: "Needs decision",
} as const satisfies Record<RunQueueFilter, string>;

export const sortLabels = {
  "blocked-first": "Blocked first",
  "decision-first": "Review decision first",
  "oldest-first": "Oldest first",
  "updated-desc": "Newest first",
} as const satisfies Record<RunQueueSort, string>;

export const defaultRunQueueFilter = "all" satisfies RunQueueFilter;
export const defaultRunQueueDensity = "comfortable" satisfies RunQueueDensity;
export const defaultRunQueueSort = "updated-desc" satisfies RunQueueSort;
