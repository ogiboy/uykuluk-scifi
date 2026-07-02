"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { submitStudioJsonMutation } from "@/lib/studioMutationSubmit";

type RunRenderDecisionActionPanelProps = Readonly<{
  commands: StudioRunDetail["renderDecisionCommands"];
  runId: string;
}>;

type SubmitState =
  | { kind: "idle"; message: string }
  | { kind: "submitting"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type RenderDecisionValue = StudioRunDetail["renderDecisionCommands"][number]["decision"];

type PendingRenderDecisionPayload = Readonly<{
  decision: RenderDecisionValue;
  notes: string;
  reviewedBy: string;
  runId: string;
}>;

/**
 * Renders the guarded Studio form for recording one local render decision.
 *
 * @param commands - The allowed render-decision command templates.
 * @param runId - The rendered run that will receive the decision evidence.
 */
export function RunRenderDecisionActionPanel({
  commands,
  runId,
}: RunRenderDecisionActionPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState(commands[0]?.decision ?? "accepted-for-local-review");
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PendingRenderDecisionPayload | null>(null);
  const [state, setState] = useState<SubmitState>({
    kind: "idle",
    message: "Records local evidence only. Upload and publish stay disabled.",
  });

  if (commands.length === 0) {
    return null;
  }

  function requestDecisionConfirmation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPendingPayload({ decision, notes, reviewedBy, runId });
    setConfirmationOpen(true);
  }

  async function confirmDecision(): Promise<void> {
    if (!pendingPayload) return;
    setConfirmationOpen(false);
    setState({ kind: "submitting", message: "Recording local render decision..." });
    const result = await submitStudioJsonMutation({
      actionId: "render.decide",
      body: pendingPayload,
      fallbackError: "Render decision could not be recorded.",
      routePath: "/actions/decide-render",
    });
    setPendingPayload(null);
    if (result.kind === "error") {
      setState(result);
      toast.error("Render decision was not recorded", { description: result.message });
      return;
    }
    setState({
      kind: "success",
      message: "Render decision recorded. Updating the run detail from persisted local evidence.",
    });
    toast.success("Render decision recorded", {
      description: "Studio is refreshing the persisted run detail.",
    });
    router.refresh();
  }

  return (
    <section className='panel' aria-labelledby='render-decision-action-heading'>
      <h2 id='render-decision-action-heading'>Record Render Decision</h2>
      <p>
        This guarded Studio action writes the same local decision evidence as the CLI. It does not
        approve upload or publish.
      </p>
      <form className='studio-form' onSubmit={requestDecisionConfirmation}>
        <label>
          Decision
          <Select
            value={decision}
            onValueChange={(value) => setDecisionFromSelectValue(value, commands, setDecision)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Choose local decision' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {commands.map((item) => (
                  <SelectItem key={item.decision} value={item.decision}>
                    {item.decision}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <label>
          Reviewed by
          <Input
            maxLength={200}
            minLength={1}
            required
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
          />
        </label>
        <label>
          Notes
          <Textarea
            className='resize-y'
            maxLength={4000}
            minLength={1}
            required
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <Button disabled={state.kind === "submitting"} type='submit'>
          Record local decision
        </Button>
      </form>
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm local render decision</DialogTitle>
            <DialogDescription>
              This writes local review evidence for {runId}. Upload and public publish stay
              disabled.
            </DialogDescription>
          </DialogHeader>
          <div className='confirmation-summary'>
            <dl className='decision-list'>
              <div>
                <dt>Decision</dt>
                <dd>{pendingPayload?.decision ?? decision}</dd>
              </div>
              <div>
                <dt>Reviewed by</dt>
                <dd>{pendingPayload?.reviewedBy ?? reviewedBy}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{runId}</dd>
              </div>
            </dl>
            <p className='artifact-action'>
              Notes are required and will be persisted with the local decision evidence.
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button disabled={state.kind === "submitting"} type='button' onClick={confirmDecision}>
              Confirm local decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className={state.kind === "error" ? "blocked" : undefined}>{state.message}</p>
    </section>
  );
}

/**
 * Applies a select value only when it matches an available render-decision command.
 *
 * @param value - The browser select value.
 * @param commands - The currently allowed render-decision commands.
 * @param setDecision - The state setter for a validated decision value.
 */
function setDecisionFromSelectValue(
  value: string,
  commands: StudioRunDetail["renderDecisionCommands"],
  setDecision: (decision: RenderDecisionValue) => void,
): void {
  const selected = commands.find((item) => item.decision === value);
  if (selected) {
    setDecision(selected.decision);
  }
}
