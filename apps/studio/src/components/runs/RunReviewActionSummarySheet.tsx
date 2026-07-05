"use client";

import { ShieldCheckIcon } from "lucide-react";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
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
    <div className='run-mobile-action-sheet'>
      <Sheet>
        <SheetTrigger asChild>
          <Button type='button'>Open action summary</Button>
        </SheetTrigger>
        <SheetContent className='run-action-sheet-content'>
          <SheetHeader>
            <SheetTitle>Run action summary</SheetTitle>
            <SheetDescription>
              Read-only mobile summary for {run.runId}. Guarded approval forms remain in the page
              action rail.
            </SheetDescription>
          </SheetHeader>

          <div className='run-action-sheet-body'>
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

            <div className='run-action-sheet-badges'>
              <Badge variant='secondary'>State: {run.state}</Badge>
              <Badge variant='outline'>Readiness: {run.readinessStatus}</Badge>
              <Badge variant='outline'>Evidence: {run.evidenceStatus}</Badge>
              <Badge variant={run.renderDecision.kind === "present" ? "secondary" : "outline"}>
                Render decision: {run.renderDecision.kind}
              </Badge>
            </div>

            <div className='operator-command-block'>
              <strong>Next safe action</strong>
              <CopyableCommand command={getNextSafeCommand(run)} label='Next safe action' />
            </div>

            <RunPrimaryActionPanel compact run={run} />

            {run.blockedActions.length > 0 ? (
              <div className='run-action-sheet-blockers'>
                <strong>Blocking evidence</strong>
                <ul>
                  {run.blockedActions.slice(0, 4).map((action, index) => (
                    <li key={`mobile-blocker-${index}-${action}`}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className='artifact-description'>
                No blocked actions are projected from the current evidence bundle.
              </p>
            )}

            {run.evidenceNextAction ? (
              <p className='artifact-action'>Evidence action: {run.evidenceNextAction}</p>
            ) : (
              <p className='artifact-description'>{run.evidenceMessage}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
