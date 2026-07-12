import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
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
import { runReviewHrefFromSummary } from "@/lib/runs/runReviewNavigation";
import { getNextSafeCommand } from "@/lib/runs/runSummaryCopy";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { Route } from "next";
import Link from "next/link";

export function ActiveRunActions({ run }: Readonly<{ run: StudioRunSummary }>) {
  const reviewHref = runReviewHrefFromSummary(run) as Route;

  return (
    <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
      <Badge variant={run.blockedActionCount > 0 ? "destructive" : "secondary"}>
        {run.blockedActionCount > 0 ? "Needs attention" : "Reviewable"}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type='button' variant='secondary'>
            Run actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-64'>
          <DropdownMenuLabel>{run.runId}</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={reviewHref}>Open review workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/runs'>Open queue</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Safety state</DropdownMenuLabel>
          <dl className='grid gap-2 px-2 py-1 text-xs' aria-label='Current run safety state'>
            <div className='grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2'>
              <dt className='text-muted-foreground'>State</dt>
              <dd className='truncate font-medium'>{run.state}</dd>
            </div>
            <div className='grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2'>
              <dt className='text-muted-foreground'>Readiness</dt>
              <dd className='truncate font-medium'>{run.readinessStatus}</dd>
            </div>
            <div className='grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2'>
              <dt className='text-muted-foreground'>Evidence</dt>
              <dd className='truncate font-medium'>{run.evidenceStatus}</dd>
            </div>
          </dl>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover>
        <PopoverTrigger asChild>
          <Button type='button' variant='ghost'>
            Safe command
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-[min(24rem,calc(100vw-2rem))]'>
          <PopoverHeader>
            <PopoverTitle>Copy the next safe CLI action</PopoverTitle>
            <PopoverDescription>
              Studio displays the command from CLI/core status. It does not infer approvals from
              artifact files.
            </PopoverDescription>
          </PopoverHeader>
          <div className='pt-3'>
            <CopyableCommand command={getNextSafeCommand(run)} label='Next safe action' />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
