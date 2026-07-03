import type { ProductionMediaStatus } from "../../../../../src/stages/statusMediaSummary";

type RunProductionMediaFactsProps = Readonly<{
  artifact: ProductionMediaStatus;
}>;

/**
 * Renders structured evidence facts for a production-media artifact.
 *
 * @param artifact - The media row whose evidence facts should be displayed.
 */
export function RunProductionMediaFacts({ artifact }: RunProductionMediaFactsProps) {
  if (artifact.facts && artifact.facts.length > 0) {
    const compactFacts = artifact.facts.filter(isCompactFact);
    const detailedFacts = artifact.facts.filter((fact) => !isCompactFact(fact));
    return (
      <>
        {compactFacts.length > 0 ? (
          <ul className='production-media-facts' aria-label={`${artifact.label} evidence facts`}>
            {compactFacts.map((fact, index) => (
              <li key={`${fact}-${index}`}>{fact}</li>
            ))}
          </ul>
        ) : null}
        {detailedFacts.length > 0 ? (
          <details className='production-media-fact-details'>
            <summary>Detailed media evidence</summary>
            <ul>
              {detailedFacts.map((fact, index) => (
                <li key={`${fact}-${index}`}>{fact}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </>
    );
  }
  return artifact.detail ? <p>{artifact.detail}</p> : null;
}

function isCompactFact(fact: string): boolean {
  return fact.length <= 72;
}
