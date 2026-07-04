"use client";

import Link from "next/link";
import type { Route } from "next";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import { getNextSafeCommand } from "@/lib/runSummaryCopy";
import type { StudioRunSummary } from "@/lib/runSummaries";

type RunSummaryRowActionsProps = Readonly<{
  run: StudioRunSummary;
}>;

/**
 * Renders row-scoped navigation and safe-command affordances for the run table.
 *
 * @param run - The Studio run summary represented by the current table row.
 * @returns Read-only row actions for opening the run workspace and copying CLI/core commands.
 */
export function RunSummaryRowActions({ run }: RunSummaryRowActionsProps) {
  const command = getNextSafeCommand(run);
  const reviewHref = runReviewHrefFromSummary(run) as Route;
  const decisionRailHref = runReviewHrefFromSummary(run, "review-decision") as Route;
  return (
    <div className='run-row-actions'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type='button' variant='secondary'>
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='run-row-actions-menu'>
          <DropdownMenuLabel>{run.runId}</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={reviewHref}>Open review workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={decisionRailHref}>Open decision rail</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Safety state</DropdownMenuLabel>
          <dl className='dropdown-status-list' aria-label={`${run.runId} safety state`}>
            <div>
              <dt>Readiness</dt>
              <dd>{run.readinessStatus}</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{run.evidenceStatus}</dd>
            </div>
            <div>
              <dt>Blocks</dt>
              <dd>{run.blockedActionCount}</dd>
            </div>
          </dl>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover>
        <PopoverTrigger asChild>
          <Button type='button' variant='ghost'>
            Command
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='run-row-command-popover'>
          <PopoverHeader>
            <PopoverTitle>Next safe CLI action</PopoverTitle>
            <PopoverDescription>
              This command comes from CLI/core status. Studio does not infer approval from files.
            </PopoverDescription>
          </PopoverHeader>
          <CopyableCommand command={command} label={`${run.runId} next action`} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
