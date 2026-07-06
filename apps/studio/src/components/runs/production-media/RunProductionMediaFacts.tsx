import type { ProductionMediaStatus } from "@/lib/runEvidenceCopy";

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
    const detailedFactCount = detailedFacts.length;
    return (
      <>
        {compactFacts.length > 0 ? (
          <ul className='flex flex-wrap gap-2' aria-label={`${artifact.label} evidence facts`}>
            {compactFacts.map((fact, index) => (
              <li
                className='rounded-full bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground'
                key={`${fact}-${index}`}
              >
                {fact}
              </li>
            ))}
          </ul>
        ) : null}
        {detailedFactCount > 0 ? (
          <p className='text-sm text-muted-foreground'>
            {detailedFactCount} detailed evidence item{detailedFactCount === 1 ? "" : "s"} available
            below.
          </p>
        ) : null}
        {detailedFactCount > 0 ? (
          <details className='rounded-lg bg-muted/10 p-3'>
            <summary className='cursor-pointer text-sm font-medium'>
              Detailed media evidence
            </summary>
            <ul className='mt-3 grid gap-2 text-sm text-muted-foreground'>
              {detailedFacts.map((fact, index) => (
                <li
                  className='break-words rounded-md bg-background/45 p-2'
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
    <p className='text-sm text-muted-foreground'>{artifact.detail}</p>
  ) : null;
}

function isCompactFact(fact: string): boolean {
  return fact.length <= 72;
}
