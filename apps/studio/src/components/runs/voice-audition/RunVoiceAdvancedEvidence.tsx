import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { StudioVoiceAuditionSummary } from "@/lib/runs/voiceAuditionSummaries";

export function RunVoiceAdvancedEvidence({
  summary,
}: Readonly<{ summary: StudioVoiceAuditionSummary }>) {
  return (
    <Accordion type='single' collapsible>
      <AccordionItem className='bg-muted/10 ring-border/5 rounded-lg px-3 ring-1' value='advanced'>
        <AccordionTrigger>
          <span className='flex flex-wrap items-center gap-2'>
            Advanced evidence
            <Badge variant='outline'>digests · paths · diagnostics</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className='grid gap-4'>
          <EvidenceList
            empty='No voice digests are available yet.'
            heading='Digests and operation identities'
            items={summary.advanced.facts.map((item) => `${item.label}: ${item.value}`)}
          />
          <EvidenceList
            empty='No voice artifact paths are registered yet.'
            heading='Artifact and ledger paths'
            items={summary.advanced.paths}
            mono
          />
          <EvidenceList
            empty='No voice read-model diagnostics were recorded.'
            heading='Diagnostics'
            items={summary.advanced.diagnostics}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function EvidenceList({
  empty,
  heading,
  items,
  mono = false,
}: Readonly<{ empty: string; heading: string; items: readonly string[]; mono?: boolean }>) {
  return (
    <div className='grid gap-2'>
      <h4 className='text-sm font-semibold'>{heading}</h4>
      {items.length > 0 ? (
        <ul className='grid gap-1.5'>
          {items.map((item) => (
            <li
              className={
                mono
                  ? "bg-background/40 rounded-md p-2 font-mono text-xs break-all"
                  : "bg-background/40 text-muted-foreground rounded-md p-2 text-sm break-words"
              }
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-muted-foreground text-sm'>{empty}</p>
      )}
    </div>
  );
}
