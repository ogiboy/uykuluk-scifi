"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { submitStudioJsonMutation } from "@/lib/studioMutationSubmit";

type RunApprovalActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "nextRecommendedCommand" | "runId" | "state">;
}>;

type SubmitState =
  | { kind: "idle"; message: string }
  | { kind: "submitting"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type ApprovalActionConfig = Readonly<{
  actionId: "cost.approve" | "idea.approve" | "render.approve" | "script.approve";
  buttonLabel: string;
  description: string;
  heading: string;
  routePath: string;
}>;

/**
 * Renders guarded Studio approval forms for local workflow approval gates.
 *
 * @param run - The current run summary.
 */
export function RunApprovalActionPanel({ run }: RunApprovalActionPanelProps) {
  const config = approvalActionForRun(run);
  const router = useRouter();
  const [ideaId, setIdeaId] = useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [state, setState] = useState<SubmitState>({
    kind: "idle",
    message: "Records explicit local approval evidence only. Upload and publish stay disabled.",
  });

  if (!config) {
    return null;
  }

  async function submitApproval(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!config) return;
    setState({ kind: "submitting", message: "Recording local approval..." });
    const result = await submitStudioJsonMutation({
      actionId: config.actionId,
      body: approvalPayload(config.actionId, run.runId, ideaId, acknowledgeWarnings),
      fallbackError: "Approval could not be recorded.",
      routePath: config.routePath,
    });
    if (result.kind === "error") {
      setState(result);
      toast.error("Approval was not recorded", { description: result.message });
      return;
    }
    setState({
      kind: "success",
      message: "Approval recorded. Updating the run detail from persisted local state.",
    });
    toast.success("Approval recorded", {
      description: "Studio is refreshing the persisted run detail.",
    });
    router.refresh();
  }

  return (
    <section className='panel' aria-labelledby='approval-action-heading'>
      <h2 id='approval-action-heading'>{config.heading}</h2>
      <p>{config.description}</p>
      <p>
        This guarded Studio action uses the same CLI/core approval gate as the copy-paste command.
      </p>
      <form className='studio-form' onSubmit={submitApproval}>
        {config.actionId === "idea.approve" ? (
          <label>
            Idea ID
            <Input
              maxLength={200}
              minLength={1}
              placeholder='idea_001'
              required
              value={ideaId}
              onChange={(event) => setIdeaId(event.target.value)}
            />
          </label>
        ) : null}
        {config.actionId === "script.approve" ? (
          <label className='checkbox-label'>
            <Checkbox
              checked={acknowledgeWarnings}
              onCheckedChange={(checked) => setAcknowledgeWarnings(checked === true)}
            />
            Acknowledge non-blocking script review warnings if present
          </label>
        ) : null}
        <Button disabled={state.kind === "submitting"} type='submit'>
          {config.buttonLabel}
        </Button>
      </form>
      <p className={state.kind === "error" ? "blocked" : undefined}>{state.message}</p>
      {run.nextRecommendedCommand ? (
        <p className='artifact-action'>CLI equivalent: {run.nextRecommendedCommand}</p>
      ) : null}
    </section>
  );
}

function approvalActionForRun(
  run: Pick<StudioRunDetail, "runId" | "state">,
): ApprovalActionConfig | null {
  if (run.state === "IDEAS_GENERATED") {
    return {
      actionId: "idea.approve",
      buttonLabel: "Approve idea",
      description: "Choose exactly one generated idea for this run.",
      heading: "Approve Idea",
      routePath: "/actions/approve-idea",
    };
  }
  if (run.state === "SCRIPT_REVIEWED") {
    return {
      actionId: "script.approve",
      buttonLabel: "Approve script",
      description: "Approve the currently reviewed script digest.",
      heading: "Approve Script",
      routePath: "/actions/approve-script",
    };
  }
  if (run.state === "COST_ESTIMATED") {
    return {
      actionId: "cost.approve",
      buttonLabel: "Approve cost",
      description: "Approve the exact current paid-generation cost quote digest.",
      heading: "Approve Cost",
      routePath: "/actions/approve-cost",
    };
  }
  if (run.state === "READY_FOR_MANUAL_PRODUCTION") {
    return {
      actionId: "render.approve",
      buttonLabel: "Approve render",
      description: "Approve local draft render execution for the current render inputs.",
      heading: "Approve Local Render",
      routePath: "/actions/approve-render",
    };
  }
  return null;
}

function approvalPayload(
  actionId: ApprovalActionConfig["actionId"],
  runId: string,
  ideaId: string,
  acknowledgeWarnings: boolean,
): Record<string, boolean | string> {
  if (actionId === "idea.approve") {
    return { ideaId, runId };
  }
  if (actionId === "script.approve") {
    return { acknowledgeWarnings, runId };
  }
  return { runId };
}
