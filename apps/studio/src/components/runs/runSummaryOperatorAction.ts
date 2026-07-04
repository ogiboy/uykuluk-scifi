import type { StudioRunSummary } from "@/lib/runSummaries";
import { buildStudioActionWorkbench } from "@/lib/studioActionWorkbench";

export type OperatorAction = ReturnType<typeof buildStudioActionWorkbench>["primary"];

const operatorActionCache = new WeakMap<StudioRunSummary, OperatorAction>();

export function operatorActionDetail(action: OperatorAction): string {
  if (action.routePath) {
    return "Guarded local web action";
  }
  if (action.command) {
    return action.tone === "blocked" ? "Blocked manual recovery" : "CLI-only next action";
  }
  return "No safe action";
}

export function operatorActionForRun(run: StudioRunSummary): OperatorAction {
  const cached = operatorActionCache.get(run);
  if (cached) {
    return cached;
  }
  const action = buildStudioActionWorkbench(run).primary;
  operatorActionCache.set(run, action);
  return action;
}

export function operatorActionSearchText(action: OperatorAction): string {
  return [action.label, action.tone, action.routePath ?? "", action.command ?? ""].join(" ");
}
