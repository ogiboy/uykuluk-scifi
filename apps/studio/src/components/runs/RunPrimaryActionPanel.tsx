"use client";

import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import {
  buildStudioRunPrimaryAction,
  type StudioRunPrimaryAction,
  type StudioRunPrimaryActionRun,
} from "@/lib/runPrimaryAction";
import { CopyableCommand } from "../studio/CopyableCommand";
import { RunQuickStageActionButton } from "./RunQuickStageActionButton";

type RunPrimaryActionPanelProps = Readonly<{
  compact?: boolean;
  railHref?: string;
  run: StudioRunPrimaryActionRun;
}>;

/**
 * Renders the primary web-first operator action for run detail and mobile review surfaces.
 *
 * @param compact - Whether the panel is rendered inside the mobile action sheet.
 * @param railHref - Optional route to the full approval or decision rail.
 * @param run - The run projection used to choose the current action affordance.
 */
export function RunPrimaryActionPanel({
  compact = false,
  railHref = "#review-decision",
  run,
}: RunPrimaryActionPanelProps) {
  const action = buildStudioRunPrimaryAction(run);
  const headingId = useId();

  return (
    <section
      className={compact ? "run-primary-action compact" : "run-primary-action"}
      aria-labelledby={headingId}
    >
      <div className='run-primary-action-heading'>
        <div>
          <p className='eyebrow'>Primary web action</p>
          <h3 id={headingId}>{action.label}</h3>
        </div>
        <Badge variant={badgeVariant(action.tone)}>{formatTone(action.tone)}</Badge>
      </div>
      <p>{action.description}</p>
      <div className='run-primary-action-controls'>
        {action.mode === "stage" ? (
          <RunQuickStageActionButton label={action.label} run={run} showResult />
        ) : null}
        {action.mode === "rail" ? (
          <a className='run-primary-action-link' href={railHref}>
            Open action rail
          </a>
        ) : null}
      </div>
      {action.mode === "command" && action.command ? (
        <div className='operator-command-block secondary-command'>
          <strong>Manual or CLI action</strong>
          <CopyableCommand command={action.command} label='Primary action command' />
        </div>
      ) : null}
      <p className='artifact-description'>
        Upload, scheduling, public publish, and paid-provider execution stay unavailable from this
        surface.
      </p>
    </section>
  );
}

function badgeVariant(
  tone: StudioRunPrimaryAction["tone"],
): "destructive" | "outline" | "secondary" {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "available" || tone === "complete") {
    return "secondary";
  }
  return "outline";
}

function formatTone(tone: StudioRunPrimaryAction["tone"]): string {
  if (tone === "available") {
    return "web";
  }
  if (tone === "blocked") {
    return "blocked";
  }
  if (tone === "complete") {
    return "done";
  }
  return "CLI";
}
