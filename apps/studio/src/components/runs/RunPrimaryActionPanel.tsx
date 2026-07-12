"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SheetClose } from "@/components/ui/sheet";
import {
  buildStudioRunPrimaryAction,
  type StudioRunPrimaryAction,
  type StudioRunPrimaryActionRun,
} from "@/lib/runs/runPrimaryAction";
import { useId } from "react";
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

  if (compact) {
    return (
      <section className='bg-muted/10 space-y-4 rounded-xl p-4' aria-labelledby={headingId}>
        <div className='grid grid-cols-[1fr_auto] items-start gap-4'>
          <PrimaryActionHeader action={action} headingId={headingId} />
        </div>
        <PrimaryActionBody
          action={action}
          closeRailAction={compact}
          railHref={railHref}
          run={run}
        />
        <PrimaryActionBoundary />
      </section>
    );
  }

  return (
    <Card className='bg-card/95 ring-primary/10 gap-5' aria-labelledby={headingId}>
      <CardHeader className='grid grid-cols-[1fr_auto] items-start gap-4'>
        <PrimaryActionHeader action={action} headingId={headingId} />
      </CardHeader>
      <CardContent className='space-y-4'>
        <PrimaryActionBody action={action} closeRailAction={false} railHref={railHref} run={run} />
      </CardContent>
      <CardFooter>
        <PrimaryActionBoundary />
      </CardFooter>
    </Card>
  );
}

function PrimaryActionHeader({
  action,
  headingId,
}: Readonly<{ action: StudioRunPrimaryAction; headingId: string }>) {
  return (
    <>
      <div className='space-y-1'>
        <p className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
          Primary web action
        </p>
        <CardTitle>
          <h3 id={headingId}>{action.label}</h3>
        </CardTitle>
      </div>
      <Badge variant={badgeVariant(action.tone)}>{formatTone(action.tone)}</Badge>
    </>
  );
}

function PrimaryActionBody({
  action,
  closeRailAction,
  railHref,
  run,
}: Readonly<{
  action: StudioRunPrimaryAction;
  closeRailAction: boolean;
  railHref: string;
  run: StudioRunPrimaryActionRun;
}>) {
  const railAction = (
    <a className={buttonVariants({ variant: "default" })} href={railHref}>
      Open action rail
    </a>
  );
  const renderedRailAction = closeRailAction ? (
    <SheetClose asChild>{railAction}</SheetClose>
  ) : (
    railAction
  );
  return (
    <>
      <p className='text-muted-foreground text-sm'>{action.description}</p>
      {action.mode === "stage" ? (
        <RunQuickStageActionButton label={action.label} run={run} showResult />
      ) : null}
      {action.mode === "rail" ? renderedRailAction : null}
      {action.mode === "command" && action.command ? (
        <div className='bg-background/50 space-y-2 rounded-md p-3'>
          <strong className='text-sm'>Manual or CLI action</strong>
          <CopyableCommand command={action.command} label='Primary action command' />
        </div>
      ) : null}
    </>
  );
}

function PrimaryActionBoundary() {
  return (
    <p className='text-muted-foreground text-xs'>
      Upload, scheduling, public publish, and paid-provider execution stay unavailable from this
      surface.
    </p>
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
