import React, { useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import {
  formatOperatorDeskBlockedActionLines,
  formatOperatorDeskReadinessLines,
  formatOperatorDeskRecentArtifactLines,
} from "./operatorDeskFormatting.js";
import { formatOperatorDeskMediaArtifactLine } from "./operatorDeskModel.js";
import type {
  OperatorDeskRun,
  OperatorDeskSelectedRun,
  OperatorDeskViewModel,
} from "./operatorDeskModel.js";

type OperatorDeskAppProps = {
  model: OperatorDeskViewModel;
};

/**
 * Mounts the operator desk as an interactive Ink terminal UI.
 *
 * @param model - The view model used to render the interface.
 */
export async function renderOperatorDesk(model: OperatorDeskViewModel): Promise<void> {
  const { waitUntilExit } = render(React.createElement(OperatorDeskApp, { model }));
  await waitUntilExit();
}

/**
 * Renders the Operator Desk terminal interface.
 *
 * Shows the recent runs list, the selected run details, and keyboard hints, or an empty state when no runs are available.
 *
 * @returns The rendered Operator Desk UI.
 */
function OperatorDeskApp({ model }: OperatorDeskAppProps): React.ReactElement {
  const initialIndex = selectedIndex(model);
  const [selected, setSelected] = useState(initialIndex);
  const { exit } = useApp();
  const selectedRun = model.runs[selected] ?? null;
  const details = selectedRun ? selectedDetails(model, selectedRun.runId) : null;

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
      return;
    }
    if (key.downArrow || input === "j") {
      setSelected((current) => Math.min(model.runs.length - 1, current + 1));
      return;
    }
    if (key.upArrow || input === "k") {
      setSelected((current) => Math.max(0, current - 1));
    }
  });

  if (model.runs.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(Text, { bold: true, color: "cyan" }, "UykulukSciFi Operator Desk"),
      React.createElement(Text, null, "No runs found."),
      React.createElement(Text, { color: "green" }, "Next safe action: pnpm producer ideas"),
      React.createElement(Text, { dimColor: true }, "Press q to exit."),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1 },
    React.createElement(Header, { generatedAt: model.generatedAt }),
    React.createElement(RunList, { runs: model.runs, selectedIndex: selected }),
    details ? React.createElement(SelectedRun, { run: details }) : null,
    React.createElement(Text, { dimColor: true }, "Keys: j/down next, k/up previous, q/esc exit."),
  );
}

/**
 * Renders the Operator Desk title and generation timestamp.
 *
 * @param generatedAt - The model generation timestamp to display.
 */
function Header({ generatedAt }: { generatedAt: string }): React.ReactElement {
  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true, color: "cyan" }, "UykulukSciFi Operator Desk"),
    React.createElement(Text, { dimColor: true }, `Generated: ${generatedAt}`),
  );
}

/**
 * Renders the recent runs list with the selected run highlighted.
 *
 * @param runs - Runs to display
 * @param selectedIndex - Index of the currently selected run
 */
function RunList({
  runs,
  selectedIndex,
}: {
  runs: OperatorDeskRun[];
  selectedIndex: number;
}): React.ReactElement {
  return React.createElement(
    Box,
    { borderStyle: "round", flexDirection: "column", paddingX: 1 },
    React.createElement(Text, { bold: true }, "Recent runs"),
    ...runs.map((run, index) => {
      const selectionMarker = index === selectedIndex ? ">" : " ";
      return React.createElement(
        Text,
        {
          color: index === selectedIndex ? "green" : undefined,
          key: run.runId,
        },
        `${selectionMarker} ${run.runId}  ${run.state}  ${run.readinessStatus}  decision:${run.renderDecisionStatus}`,
      );
    }),
  );
}

/**
 * Renders the selected run details panel.
 *
 * @param run - The run to display.
 */
function SelectedRun({ run }: { run: OperatorDeskSelectedRun }): React.ReactElement {
  return React.createElement(
    Box,
    { borderStyle: "round", flexDirection: "column", paddingX: 1 },
    React.createElement(Text, { bold: true }, `Selected: ${run.runId}`),
    React.createElement(Text, null, `State: ${run.state}`),
    React.createElement(Text, null, `Evidence: ${run.evidenceStatus}`),
    ...formatOperatorDeskReadinessLines(run.readiness).map((line, index) =>
      React.createElement(Text, { key: `readiness:${index}:${line}` }, line),
    ),
    React.createElement(Text, null, `Render decision: ${renderDecisionSummary(run)}`),
    React.createElement(
      Text,
      null,
      `Approvals/artifacts/warnings: ${run.approvalCount}/${run.artifactCount}/${run.warningCount}`,
    ),
    React.createElement(Text, null, `Blocked actions: ${run.blockedActionCount ?? "unknown"}`),
    ...formatOperatorDeskBlockedActionLines(run.blockedActions).map((line, index) =>
      React.createElement(Text, { key: `blocked:${index}:${line}` }, line),
    ),
    React.createElement(
      Text,
      { color: "green" },
      `Next safe action: ${run.nextRecommendedCommand}`,
    ),
    React.createElement(Text, { bold: true }, "Production media"),
    ...run.mediaArtifacts.map((artifact) =>
      React.createElement(
        Text,
        { key: artifact.evidenceKey },
        formatOperatorDeskMediaArtifactLine(artifact),
      ),
    ),
    ...formatOperatorDeskRecentArtifactLines(run.recentArtifacts).map((line, index) =>
      React.createElement(Text, { key: `artifacts:${index}:${line}` }, line),
    ),
  );
}

/**
 * Formats the render decision for display.
 *
 * @param run - The selected run to summarize.
 * @returns The decision text with reviewer information when present, or the decision kind otherwise.
 */
function renderDecisionSummary(run: OperatorDeskSelectedRun): string {
  if (run.renderDecision.kind === "present") {
    return `${run.renderDecision.decision.decision} by ${run.renderDecision.decision.reviewedBy}`;
  }
  return run.renderDecision.kind;
}

/**
 * Determines the initial selected run index for the operator desk.
 *
 * @param model - The operator desk view model.
 * @returns The matching run index, or `0` when no selected run is set or the run cannot be found.
 */
function selectedIndex(model: OperatorDeskViewModel): number {
  if (!model.selectedRun) {
    return 0;
  }
  const index = model.runs.findIndex((run) => run.runId === model.selectedRun?.runId);
  return Math.max(0, index);
}

/**
 * Resolves the selected-run details for a run ID.
 *
 * @param model - The operator desk view model
 * @param runId - The run ID to look up
 * @returns The matching selected-run details, or `null` if no matching run is found
 */
function selectedDetails(
  model: OperatorDeskViewModel,
  runId: string,
): OperatorDeskSelectedRun | null {
  if (model.selectedRun?.runId === runId) {
    return model.selectedRun;
  }
  return model.runDetails.find((run) => run.runId === runId) ?? null;
}
