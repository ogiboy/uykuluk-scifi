"use client";

import { ShieldCheckIcon } from "lucide-react";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getNextSafeCommand } from "@/lib/runSummaryCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunPrimaryActionPanel } from "./RunPrimaryActionPanel";

type RunReviewActionSummarySheetProps = Readonly<{
  run: Pick<
    StudioRunDetail,
    | "blockedActionCount"
    | "blockedActions"
    | "channelHandoff"
    | "channelHandoffDecision"
    | "evidenceMessage"
    | "evidenceNextAction"
    | "evidenceStatus"
    | "nextRecommendedCommand"
    | "readinessStatus"
    | "renderDecision"
    | "renderDecisionCommands"
    | "runId"
    | "state"
  >;
}>;

/**
 * Renders a compact mobile action summary for a run without duplicating guarded mutation forms.
 *
 * @param run - The Studio run detail projection to summarize for the mobile sheet.
 */
export function RunReviewActionSummarySheet({ run }: RunReviewActionSummarySheetProps) {
  return (
    <div className='block min-[901px]:hidden'>
      <Sheet>
        <SheetTrigger asChild>
          <Button type='button'>Open action summary</Button>
        </SheetTrigger>
        <SheetContent className='w-[min(92vw,440px)] overflow-y-auto'>
          <SheetHeader>
            <SheetTitle>Run action summary</SheetTitle>
            <SheetDescription>
              Read-only mobile summary for {run.runId}. Guarded approval forms remain in the page
              action rail.
            </SheetDescription>
          </SheetHeader>

          <div className='grid gap-3 px-4 pb-4'>
            <Alert variant={run.blockedActionCount > 0 ? "destructive" : "default"}>
              <ShieldCheckIcon />
              <AlertTitle>
                {run.blockedActionCount > 0 ? "Blocked before progression" : "Reviewable state"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  Upload and publish remain disabled. Studio never infers approval from local files.
                </p>
              </AlertDescription>
            </Alert>

            <div className='grid justify-items-start gap-3'>
              <Badge variant='secondary'>State: {run.state}</Badge>
              <Badge variant='outline'>Readiness: {run.readinessStatus}</Badge>
              <Badge variant='outline'>Evidence: {run.evidenceStatus}</Badge>
              <Badge variant={run.renderDecision.kind === "present" ? "secondary" : "outline"}>
                Render decision: {run.renderDecision.kind}
              </Badge>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/15 p-4 ring-1 ring-border/5'>
              <div className='grid gap-1 text-sm'>
                <strong>CLI/core fallback</strong>
                <span className='text-muted-foreground'>
                  Reveal only when you need terminal recovery or audit copy.
                </span>
              </div>
              <CliFallbackCommand
                align='start'
                command={getNextSafeCommand(run)}
                label='Next safe action'
              />
            </div>

            <RunPrimaryActionPanel compact run={run} />

            {run.blockedActions.length > 0 ? (
              <div className='grid gap-3'>
                <strong>Blocking evidence</strong>
                <ul className='grid gap-2 pl-5 text-muted-foreground'>
                  {run.blockedActions.slice(0, 4).map((action, index) => (
                    <li key={`mobile-blocker-${index}-${action}`}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                No blocked actions are projected from the current evidence bundle.
              </p>
            )}

            {run.evidenceNextAction ? (
              <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/15 p-3 ring-1 ring-border/5'>
                <p className='text-sm text-muted-foreground'>
                  Evidence action is available as a CLI/core fallback.
                </p>
                <CliFallbackCommand
                  align='start'
                  command={run.evidenceNextAction}
                  label='Evidence action'
                  triggerLabel='Show evidence fallback'
                />
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>{run.evidenceMessage}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
