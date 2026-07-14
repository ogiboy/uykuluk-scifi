import type { StudioMutationActionId } from "../../../../../src/studio/actionServiceMetadata";
import type { StudioActionServiceStatus, StudioActionServiceSummary } from "../actionServiceStatus";

export type StudioWorkflowActionStatus = "disabled" | "unrouted" | "web-ready";

export type StudioWorkflowAction = Readonly<{
  actionId: StudioMutationActionId;
  cliCommand: string;
  description: string;
  routePath: string;
  status: StudioWorkflowActionStatus;
}>;

export type StudioWorkflowActionStep = Readonly<{
  actions: readonly StudioWorkflowAction[];
  label: string;
  summary: string;
}>;

type StudioWorkflowActionStepDefinition = Readonly<{
  actionIds: readonly StudioMutationActionId[];
  label: string;
  summary: string;
}>;

const workflowActionStepDefinitions = [
  {
    actionIds: ["doctor.run", "ideas.run", "idea.approve"],
    label: "Idea intake",
    summary: "Refresh diagnostics, generate non-repeating ideas, then approve one idea.",
  },
  {
    actionIds: ["script.run", "script.review", "script.revise", "script.approve"],
    label: "Script review",
    summary: "Generate, review, revise, and approve the current script digest.",
  },
  {
    actionIds: ["package.run", "package-artifact.revise", "render-plan.run", "render-plan.review"],
    label: "Production planning",
    summary: "Create package artifacts, revise bounded package files, and review render planning.",
  },
  {
    actionIds: ["estimate.run", "evidence.run", "readiness.run"],
    label: "Proof and readiness",
    summary: "Regenerate cost, evidence, and readiness proof before production work.",
  },
  {
    actionIds: [
      "voice.run",
      "voice.review",
      "render.approve",
      "render.run",
      "render.review",
      "render.revise",
    ],
    label: "Production media review",
    summary:
      "Generate and review configured voiceover plus the local draft render after explicit approval.",
  },
  {
    actionIds: [
      "render.decide",
      "review-bundle.run",
      "channel-handoff.run",
      "channel-handoff.decide",
    ],
    label: "Final local decision",
    summary: "Record local review decisions and prepare manual channel handoff evidence.",
  },
  {
    actionIds: [
      "analytics.import",
      "analytics.report",
      "model-eval.run",
      "model-eval-candidates.run",
    ],
    label: "Feedback and evaluation",
    summary: "Refresh manual analytics and local model evaluation artifacts.",
  },
  {
    actionIds: ["upload.private", "publish.schedule"],
    label: "Deferred external actions",
    summary: "Upload and public/scheduled publishing remain disabled by default.",
  },
] as const satisfies readonly StudioWorkflowActionStepDefinition[];

/**
 * Projects mutation service contracts into the operator-facing v1 workflow order.
 *
 * @param status - Current route and service-contract status.
 * @returns Ordered workflow steps with route readiness for each action.
 */
export function studioWorkflowActionSteps(
  status: StudioActionServiceStatus,
): StudioWorkflowActionStep[] {
  const summaryById = new Map(status.summaries.map((summary) => [summary.actionId, summary]));
  return workflowActionStepDefinitions.map((step) => ({
    actions: step.actionIds.map((actionId) => workflowAction(actionId, summaryById)),
    label: step.label,
    summary: step.summary,
  }));
}

function workflowAction(
  actionId: StudioMutationActionId,
  summaries: ReadonlyMap<string, StudioActionServiceSummary>,
): StudioWorkflowAction {
  const summary = summaries.get(actionId);
  if (!summary) {
    return {
      actionId,
      cliCommand: "missing service contract",
      description: "This workflow action is missing from the shared service contract catalog.",
      routePath: "unrouted",
      status: "unrouted",
    };
  }
  return {
    actionId,
    cliCommand: summary.cliCommand,
    description: summary.description,
    routePath: summary.routePath,
    status: workflowActionStatus(summary),
  };
}

function workflowActionStatus(summary: StudioActionServiceSummary): StudioWorkflowActionStatus {
  if (summary.availability === "disabled-external") {
    return "disabled";
  }
  return summary.routePath === "unrouted" ? "unrouted" : "web-ready";
}
