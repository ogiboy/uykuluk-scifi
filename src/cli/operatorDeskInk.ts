import React, { useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import type {
  OperatorDeskRun,
  OperatorDeskSelectedRun,
  OperatorDeskViewModel,
} from "./operatorDeskModel.js";

type OperatorDeskAppProps = {
  model: OperatorDeskViewModel;
};

/**
 * Renders the operator desk as an interactive Ink terminal UI.
 *
 * @param model - The model to render.
 */
export async function renderOperatorDesk(model: OperatorDeskViewModel): Promise<void> {
  const { waitUntilExit } = render(React.createElement(OperatorDeskApp, { model }));
  await waitUntilExit();
}

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

function Header({ generatedAt }: { generatedAt: string }): React.ReactElement {
  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true, color: "cyan" }, "UykulukSciFi Operator Desk"),
    React.createElement(Text, { dimColor: true }, `Generated: ${generatedAt}`),
  );
}

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
    ...runs.map((run, index) =>
      React.createElement(
        Text,
        {
          color: index === selectedIndex ? "green" : undefined,
          key: run.runId,
        },
        `${index === selectedIndex ? ">" : " "} ${run.runId}  ${run.state}  ${run.readinessStatus}`,
      ),
    ),
  );
}

function SelectedRun({ run }: { run: OperatorDeskSelectedRun }): React.ReactElement {
  return React.createElement(
    Box,
    { borderStyle: "round", flexDirection: "column", paddingX: 1 },
    React.createElement(Text, { bold: true }, `Selected: ${run.runId}`),
    React.createElement(Text, null, `State: ${run.state}`),
    React.createElement(Text, null, `Evidence: ${run.evidenceStatus}`),
    React.createElement(Text, null, `Readiness: ${run.readinessStatus}`),
    React.createElement(
      Text,
      null,
      `Approvals/artifacts/warnings: ${run.approvalCount}/${run.artifactCount}/${run.warningCount}`,
    ),
    React.createElement(Text, null, `Blocked actions: ${run.blockedActionCount ?? "unknown"}`),
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
        `- ${artifact.label}: ${artifact.status}${artifact.detail ? ` (${artifact.detail})` : ""}`,
      ),
    ),
  );
}

function selectedIndex(model: OperatorDeskViewModel): number {
  if (!model.selectedRun) {
    return 0;
  }
  const index = model.runs.findIndex((run) => run.runId === model.selectedRun?.runId);
  return index >= 0 ? index : 0;
}

function selectedDetails(
  model: OperatorDeskViewModel,
  runId: string,
): OperatorDeskSelectedRun | null {
  if (model.selectedRun?.runId === runId) {
    return model.selectedRun;
  }
  return model.runDetails.find((run) => run.runId === runId) ?? null;
}
