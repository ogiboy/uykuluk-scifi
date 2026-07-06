import type { StudioRunSummary } from "@/lib/runSummaries";
import { buildStudioActionWorkbench } from "@/lib/studioActionWorkbench";

export type OperatorAction = ReturnType<typeof buildStudioActionWorkbench>["primary"];

const operatorActionCache = new WeakMap<StudioRunSummary, OperatorAction>();

export function operatorActionDetail(action: OperatorAction): string {
  if (action.routePath) {
    return "Guarded local web action";
  }
  if (action.tone === "attention") {
    return "Needs operator review";
  }
  if (action.command) {
    return action.tone === "blocked" ? "Blocked manual recovery" : "CLI-only next action";
  }
  return "No safe action";
}

export function operatorActionToneLabel(action: OperatorAction): string {
  if (action.tone === "available" && action.routePath) {
    return "web";
  }
  if (action.tone === "blocked") {
    return "blocked";
  }
  if (action.tone === "complete") {
    return "done";
  }
  if (action.tone === "attention") {
    return "review";
  }
  return "CLI";
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
