"use client";

import { useState, type FormEvent } from "react";
import { studioMutationJsonHeaders } from "@/lib/studioMutationClient";
import type { StudioRunDetail } from "@/lib/runSummaries";

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
  const [decision, setDecision] = useState(commands[0]?.decision ?? "accepted-for-local-review");
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [state, setState] = useState<SubmitState>({
    kind: "idle",
    message: "Records local evidence only. Upload and publish stay disabled.",
  });

  if (commands.length === 0) {
    return null;
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState({ kind: "submitting", message: "Recording local render decision..." });
    let headers;
    try {
      headers = await studioMutationJsonHeaders("render.decide");
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Studio local session failed.",
      });
      return;
    }
    const response = await fetch("/actions/decide-render", {
      body: JSON.stringify({ decision, notes, reviewedBy, runId }),
      headers,
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setState({
        kind: "error",
        message: payload?.message ?? "Render decision could not be recorded.",
      });
      return;
    }
    setState({
      kind: "success",
      message: "Render decision recorded. Refresh the run detail to view persisted evidence.",
    });
  }

  return (
    <section className='panel' aria-labelledby='render-decision-action-heading'>
      <h2 id='render-decision-action-heading'>Record Render Decision</h2>
      <p>
        This guarded Studio action writes the same local decision evidence as the CLI. It does not
        approve upload or publish.
      </p>
      <form className='studio-form' onSubmit={submitDecision}>
        <label>
          Decision
          <select
            value={decision}
            onChange={(event) =>
              setDecisionFromSelectValue(event.target.value, commands, setDecision)
            }
          >
            {commands.map((item) => (
              <option key={item.decision} value={item.decision}>
                {item.decision}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reviewed by
          <input
            maxLength={200}
            minLength={1}
            required
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea
            maxLength={4000}
            minLength={1}
            required
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button disabled={state.kind === "submitting"} type='submit'>
          Record local decision
        </button>
      </form>
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
