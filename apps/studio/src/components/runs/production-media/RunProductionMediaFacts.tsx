import type { ProductionMediaStatus } from "@/lib/runEvidenceCopy";

type RunProductionMediaFactsProps = Readonly<{ artifact: ProductionMediaStatus }>;

/**
 * Renders structured evidence facts for a production-media artifact.
 *
 * @param artifact - The media row whose evidence facts should be displayed.
 */
export function RunProductionMediaFacts({ artifact }: RunProductionMediaFactsProps) {
  if (artifact.facts && artifact.facts.length > 0) {
    const compactFacts = artifact.facts.filter(isCompactFact);
    const detailedFacts = artifact.facts.filter((fact) => !isCompactFact(fact));
    const detailedFactCount = detailedFacts.length;
    return (
      <>
        {compactFacts.length > 0 ? (
          <ul className='flex flex-wrap gap-2' aria-label={`${artifact.label} evidence facts`}>
            {compactFacts.map((fact, index) => (
              <li
                className='bg-muted/20 text-muted-foreground rounded-full px-2.5 py-1 text-xs'
                key={`${fact}-${index}`}
              >
                {fact}
              </li>
            ))}
          </ul>
        ) : null}
        {detailedFactCount > 0 ? (
          <p className='text-muted-foreground text-sm'>
            {detailedFactCount} detailed evidence item{detailedFactCount === 1 ? "" : "s"} available
            below.
          </p>
        ) : null}
        {detailedFactCount > 0 ? (
          <details className='bg-muted/10 rounded-lg p-3'>
            <summary className='cursor-pointer text-sm font-medium'>
              Detailed media evidence
            </summary>
            <ul className='text-muted-foreground mt-3 grid gap-2 text-sm'>
              {detailedFacts.map((fact, index) => (
                <li
                  className='bg-background/45 rounded-md p-2 break-words'
                  key={`${fact}-${index}`}
                >
                  {fact}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </>
    );
  }
  return artifact.detail ? (
    <p className='text-muted-foreground text-sm'>{artifact.detail}</p>
  ) : null;
}

function isCompactFact(fact: string): boolean {
  return fact.length <= 72;
}
