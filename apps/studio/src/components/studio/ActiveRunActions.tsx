import Link from "next/link";
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
import type { StudioRunSummary } from "@/lib/runSummaries";

export function ActiveRunActions({ run }: Readonly<{ run: StudioRunSummary }>) {
  return (
    <div className='active-run-actions'>
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
              <Link href={`/runs/${run.runId}`}>Open review workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/runs'>Open queue</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Safety state</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem disabled>State: {run.state}</DropdownMenuItem>
            <DropdownMenuItem disabled>Readiness: {run.readinessStatus}</DropdownMenuItem>
            <DropdownMenuItem disabled>Evidence: {run.evidenceStatus}</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover>
        <PopoverTrigger asChild>
          <Button type='button' variant='ghost'>
            Safe command
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-96'>
          <PopoverHeader>
            <PopoverTitle>Copy the next safe CLI action</PopoverTitle>
            <PopoverDescription>
              Studio displays the command from CLI/core status. It does not infer approvals from
              artifact files.
            </PopoverDescription>
          </PopoverHeader>
          <CopyableCommand
            command={run.nextRecommendedCommand ?? `pnpm producer evidence --run ${run.runId}`}
            label='Next safe action'
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
