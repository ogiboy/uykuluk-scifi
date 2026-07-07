import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { studioMutationRecoveryCopy } from "@/lib/studioMutationRecoveryCopy";
import {
  studioMutationResultHref,
  studioMutationResultLinkLabel,
} from "@/lib/studioMutationResultNavigation";
import type { StudioGuardedActionSubmitState } from "@/lib/useStudioGuardedActionSubmit";
import { cn } from "@/lib/utils";
import type { Route } from "next";
import Link from "next/link";

type StudioMutationResultPanelProps = Readonly<{ state: StudioGuardedActionSubmitState }>;

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
      className={cn(
        "bg-muted/20 grid gap-3 rounded-lg p-3 text-sm",
        isProblem && "border-destructive/40 bg-destructive/10 border",
      )}
      aria-label='Latest local action result'
      aria-live={isProblem ? "assertive" : "polite"}
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-muted-foreground'>{state.message}</p>
        <Badge variant={isProblem ? "destructive" : "secondary"}>{state.kind}</Badge>
      </div>
      {actionFacts.length > 0 ? (
        <dl className='grid gap-2 sm:grid-cols-2' aria-label='Local Studio action boundary'>
          {actionFacts.map((fact, index) => (
            <div className='bg-background/55 rounded-md p-2' key={`${fact.label}-${index}`}>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                {fact.label}
              </dt>
              <dd className='mt-1 break-all'>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {recovery ? (
        <div className='border-destructive/40 bg-destructive/10 grid gap-2 rounded-lg border p-3'>
          <p className='text-destructive'>{recovery.detail}</p>
          <Link className={buttonVariants({ variant: "secondary" })} href={recovery.href}>
            {recovery.label}
          </Link>
        </div>
      ) : null}
      {hasStudioMutationRecordSummary(state) ? (
        <>
          {state.recordSummary.runId ? (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={
                studioMutationResultHref(state.recordSummary.runId, state.action.actionId) as Route
              }
            >
              {studioMutationResultLinkLabel(state.action.actionId)}
            </Link>
          ) : null}
          <dl className='grid gap-2' aria-label='Producer record summary'>
            {state.recordSummary.facts.map((fact, index) => (
              <div className='bg-background/55 rounded-md p-2' key={`${fact}-${index}`}>
                <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                  Result
                </dt>
                <dd className='mt-1 break-words'>{fact}</dd>
              </div>
            ))}
          </dl>
        </>
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
