import Link from "next/link";
import { studioMutationRecoveryCopy } from "@/lib/studioMutationRecoveryCopy";
import type { StudioGuardedActionSubmitState } from "@/lib/useStudioGuardedActionSubmit";

type StudioMutationResultPanelProps = Readonly<{
  state: StudioGuardedActionSubmitState;
}>;

type StudioMutationStateWithAction = Extract<StudioGuardedActionSubmitState, { action: unknown }>;
type StudioMutationStateWithOptionalRecordSummary = Extract<
  StudioGuardedActionSubmitState,
  { recordSummary: unknown }
>;
type StudioMutationStateWithRecordSummary = StudioMutationStateWithOptionalRecordSummary &
  Readonly<{
    recordSummary: NonNullable<StudioMutationStateWithOptionalRecordSummary["recordSummary"]>;
  }>;

/**
 * Shows the latest guarded local mutation status and compact producer record summary.
 *
 * @param state - The shared guarded-action submit state.
 */
export function StudioMutationResultPanel({ state }: StudioMutationResultPanelProps) {
  const isProblem = mutationResultIsProblem(state);
  const actionFacts = mutationBoundaryFacts(state);
  const recovery = studioMutationRecoveryCopy(state);
  return (
    <section
      className={isProblem ? "mutation-result blocked" : "mutation-result"}
      aria-label='Latest local action result'
      aria-live={isProblem ? "assertive" : "polite"}
    >
      <p>{state.message}</p>
      {actionFacts.length > 0 ? (
        <dl aria-label='Local Studio action boundary'>
          {actionFacts.map((fact, index) => (
            <div key={`${fact.label}-${index}`}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {recovery ? (
        <div className='mutation-recovery-actions'>
          <p>{recovery.detail}</p>
          <Link href={recovery.href}>{recovery.label}</Link>
        </div>
      ) : null}
      {hasStudioMutationRecordSummary(state) ? (
        <dl aria-label='Producer record summary'>
          {state.recordSummary.facts.map((fact, index) => (
            <div key={`${fact}-${index}`}>
              <dt>Result</dt>
              <dd>{fact}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function mutationBoundaryFacts(
  state: StudioGuardedActionSubmitState,
): { label: string; value: string }[] {
  const facts = hasStudioMutationAction(state) ? studioActionFacts(state.action) : [];
  if (!hasHttpStatus(state)) {
    return facts;
  }
  return [...facts, { label: "HTTP status", value: String(state.status) }];
}

function studioActionFacts(
  action: StudioMutationStateWithAction["action"],
): { label: string; value: string }[] {
  return [
    { label: "Action", value: action.actionId },
    { label: "Route", value: action.routePath },
    {
      label: "Refresh",
      value: action.refreshedPersistedState
        ? "Persisted local state refresh requested"
        : "Waiting for route result",
    },
  ];
}

function mutationResultIsProblem(state: StudioGuardedActionSubmitState): boolean {
  return state.kind === "blocked" || state.kind === "error";
}

function hasStudioMutationAction(
  state: StudioGuardedActionSubmitState,
): state is StudioMutationStateWithAction {
  return "action" in state;
}

function hasStudioMutationRecordSummary(
  state: StudioGuardedActionSubmitState,
): state is StudioMutationStateWithRecordSummary {
  return "recordSummary" in state && state.recordSummary !== null;
}

function hasHttpStatus(
  state: StudioGuardedActionSubmitState,
): state is Extract<StudioGuardedActionSubmitState, { status?: number }> &
  Readonly<{ status: number }> {
  return "status" in state && typeof state.status === "number";
}
