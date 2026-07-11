"use client";

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
import type { StudioRunSummary } from "@/lib/runSummaries";
import { getNextSafeCommand } from "@/lib/runSummaryCopy";
import type { Route } from "next";
import Link from "next/link";
import { RunQuickStageActionButton } from "./RunQuickStageActionButton";
import { operatorActionForRun } from "./runSummaryOperatorAction";

type RunSummaryRowActionsProps = Readonly<{ run: StudioRunSummary }>;

/**
 * Renders row-scoped navigation and safe-command affordances for the run table.
 *
 * @param run - The Studio run summary represented by the current table row.
 * @returns Read-only row actions for opening the run workspace and copying CLI/core commands.
 */
export function RunSummaryRowActions({ run }: RunSummaryRowActionsProps) {
  const action = operatorActionForRun(run);
  const command = getNextSafeCommand(run);
  const reviewHref = runReviewHrefFromSummary(run) as Route;
  const decisionRailHref = runReviewHrefFromSummary(run, "review-decision") as Route;
  return (
    <div className='flex flex-wrap items-center justify-end gap-2 [&_button]:whitespace-nowrap'>
      <RunQuickStageActionButton label={action.label} run={run} variant='secondary' />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type='button' variant='secondary'>
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-72'>
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
          <dl className='grid gap-2 px-2 pb-2 text-sm' aria-label={`${run.runId} safety state`}>
            <div className='grid grid-cols-[6rem_1fr] gap-3'>
              <dt className='text-muted-foreground'>Readiness</dt>
              <dd className='font-semibold'>{run.readinessStatus}</dd>
            </div>
            <div className='grid grid-cols-[6rem_1fr] gap-3'>
              <dt className='text-muted-foreground'>Evidence</dt>
              <dd className='font-semibold'>{run.evidenceStatus}</dd>
            </div>
            <div className='grid grid-cols-[6rem_1fr] gap-3'>
              <dt className='text-muted-foreground'>Blocks</dt>
              <dd className='font-semibold'>{run.blockedActionCount}</dd>
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
        <PopoverContent align='end' className='w-[min(420px,calc(100vw-2rem))]'>
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
