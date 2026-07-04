import type { StudioGuardedActionSubmitState } from "@/lib/useStudioGuardedActionSubmit";

type StudioMutationResultPanelProps = Readonly<{
  state: StudioGuardedActionSubmitState;
}>;

/**
 * Shows the latest guarded local mutation status and compact producer record summary.
 *
 * @param state - The shared guarded-action submit state.
 */
export function StudioMutationResultPanel({ state }: StudioMutationResultPanelProps) {
  const isProblem = state.kind === "error" || state.kind === "blocked";
  return (
    <section
      className={isProblem ? "mutation-result blocked" : "mutation-result"}
      aria-label='Latest local action result'
      aria-live='polite'
    >
      <p>{state.message}</p>
      {"recordSummary" in state && state.recordSummary ? (
        <dl>
          {state.recordSummary.facts.map((fact) => (
            <div key={fact}>
              <dt>Result</dt>
              <dd>{fact}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
