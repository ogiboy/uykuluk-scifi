import type { StudioRunDetail } from "./runSummaries";

export type StudioActionPreflightAction =
  | "channel-handoff.decide"
  | "cost.approve"
  | "idea.approve"
  | "render.approve"
  | "render.decide"
  | "script.approve";

export type StudioActionPreflightItem = Readonly<{
  detail: string;
  label: string;
  status: "attention" | "done" | "pending" | "ready";
}>;

export type StudioActionPreflight = Readonly<{
  copy: string;
  items: readonly StudioActionPreflightItem[];
  title: string;
}>;

type StudioActionPreflightRun = Pick<
  StudioRunDetail,
  | "blockedActionCount"
  | "evidenceMessage"
  | "evidenceStatus"
  | "nextRecommendedCommand"
  | "readinessMessage"
  | "readinessStatus"
  | "runId"
  | "state"
>;

export type StudioActionPreflightInput = Readonly<{
  actionId: StudioActionPreflightAction;
  acknowledgeWarnings?: boolean;
  run: StudioActionPreflightRun;
  selectedIdeaId?: string;
}>;

/**
 * Builds operator-facing preflight copy for a guarded Studio action.
 *
 * This is presentation-only. Enforcement remains owned by the matching Studio route and CLI/core
 * stage contract.
 *
 * @param input - Action, run projection, and transient form values.
 * @returns The preflight checklist shown before an operator confirms a local action.
 */
export function buildStudioActionPreflight(
  input: StudioActionPreflightInput,
): StudioActionPreflight {
  return {
    copy: preflightCopy(input.actionId),
    items: [
      actionStateItem(input),
      payloadItem(input),
      evidenceItem(input.run),
      readinessItem(input.run),
      blockedActionItem(input.run),
      uploadPublishBoundaryItem(),
    ],
    title: "Action preflight",
  };
}

function actionStateItem(input: StudioActionPreflightInput): StudioActionPreflightItem {
  return {
    detail: `Current run state is ${input.run.state}; the server route will re-check this before writing evidence.`,
    label: "Core state",
    status: "done",
  };
}

function payloadItem(input: StudioActionPreflightInput): StudioActionPreflightItem {
  if (input.actionId === "idea.approve") {
    const selectedIdeaId = input.selectedIdeaId?.trim() ?? "";
    return {
      detail:
        selectedIdeaId.length > 0
          ? `Selected idea ${selectedIdeaId} will be sent to the core approval contract.`
          : "Select one generated idea before submitting approval.",
      label: "Payload",
      status: selectedIdeaId.length > 0 ? "done" : "attention",
    };
  }
  if (input.actionId === "script.approve") {
    return {
      detail: input.acknowledgeWarnings
        ? "Non-blocking script review warnings will be explicitly acknowledged."
        : "If script review warnings exist, the core approval contract will reject until acknowledged.",
      label: "Warnings",
      status: input.acknowledgeWarnings ? "done" : "ready",
    };
  }
  if (input.actionId === "render.decide" || input.actionId === "channel-handoff.decide") {
    return {
      detail:
        "Decision, reviewer, and notes will be persisted as local review evidence only. Upload and publish remain disabled.",
      label: "Payload",
      status: "done",
    };
  }
  return {
    detail:
      "The request sends only the run id; exact digests and approval boundaries are checked server-side.",
    label: "Payload",
    status: "done",
  };
}

function evidenceItem(run: StudioActionPreflightRun): StudioActionPreflightItem {
  if (run.evidenceStatus === "available") {
    return {
      detail: "Current evidence is available for operator review.",
      label: "Evidence",
      status: "done",
    };
  }
  return {
    detail: `${run.evidenceMessage} Regenerate evidence if this action depends on current proof.`,
    label: "Evidence",
    status: "attention",
  };
}

function readinessItem(run: StudioActionPreflightRun): StudioActionPreflightItem {
  if (run.readinessStatus === "passed") {
    return {
      detail: "Readiness checks are passing for the current persisted run state.",
      label: "Readiness",
      status: "done",
    };
  }
  return { detail: run.readinessMessage, label: "Readiness", status: "attention" };
}

function blockedActionItem(run: StudioActionPreflightRun): StudioActionPreflightItem {
  if (run.blockedActionCount === 0) {
    return {
      detail: "No projected blocked actions are listed in current evidence.",
      label: "Blocked actions",
      status: "done",
    };
  }
  return {
    detail: `${run.blockedActionCount} blocked action${
      run.blockedActionCount === 1 ? "" : "s"
    } remain visible; the server route still owns the final gate.`,
    label: "Blocked actions",
    status: "attention",
  };
}

function uploadPublishBoundaryItem(): StudioActionPreflightItem {
  return {
    detail: "This web action cannot upload, schedule, publish, or call paid providers.",
    label: "Upload / publish",
    status: "done",
  };
}

function preflightCopy(actionId: StudioActionPreflightAction): string {
  if (actionId === "render.decide") {
    return "Confirm the local render-review decision before Studio writes durable decision evidence.";
  }
  if (actionId === "channel-handoff.decide") {
    return "Confirm the manual channel-handoff decision before Studio writes durable local evidence.";
  }
  if (actionId === "render.approve") {
    return "Confirm current local media inputs before allowing the CLI/core render approval contract to run.";
  }
  return "Confirm the local approval gate before Studio calls the matching CLI/core contract.";
}
