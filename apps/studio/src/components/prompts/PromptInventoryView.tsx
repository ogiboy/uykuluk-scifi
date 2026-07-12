import type {
  StudioPromptEntry,
  StudioPromptInventory,
  StudioPromptStatus,
} from "@/lib/catalogs/promptInventoryTypes";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function PromptInventoryView({ inventory }: Readonly<{ inventory: StudioPromptInventory }>) {
  return (
    <section className='grid gap-3' aria-labelledby='prompt-inventory-heading'>
      <div className='space-y-2'>
        <h3 className='text-xl font-semibold tracking-tight' id='prompt-inventory-heading'>
          Runtime prompt inventory
        </h3>
        <p className='text-muted-foreground text-sm'>
          Read-only prompt source visibility. Studio does not edit prompts, approve prompt changes,
          call providers, or make `.ai/` part of runtime.
        </p>
      </div>
      <dl className='grid gap-3 text-sm sm:grid-cols-2'>
        <PromptFact label='Config' value={inventory.configSource} />
        <PromptFact label='Status' value={inventory.passed ? "Ready" : "Needs action"} />
      </dl>
      {inventory.warnings.length > 0 ? (
        <ul className='text-muted-foreground grid list-disc gap-2 pl-5 text-sm'>
          {inventory.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className='text-muted-foreground text-sm'>No prompt inventory warnings.</p>
      )}
      <div className='grid gap-3 lg:grid-cols-2 xl:grid-cols-3'>
        {inventory.prompts.map((prompt) => (
          <PromptInventoryCard key={prompt.key} prompt={prompt} />
        ))}
      </div>
    </section>
  );
}

function PromptInventoryCard({ prompt }: Readonly<{ prompt: StudioPromptEntry }>) {
  return (
    <Card>
      <CardHeader className='gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
        <div className='min-w-0 space-y-1'>
          <CardTitle className='text-base'>{prompt.label}</CardTitle>
          <span className='text-muted-foreground block text-xs break-all'>
            {prompt.contractMarker}
          </span>
        </div>
        <Badge variant={promptStatusBadgeVariant(prompt.status)}>{promptStatusLabel(prompt)}</Badge>
      </CardHeader>
      <CardContent className='space-y-3'>
        <dl className='grid gap-3 text-sm sm:grid-cols-2'>
          <PromptFact label='Default' value={prompt.defaultPath} />
          <PromptFact label='Selected' value={prompt.selectedPath ?? "none"} />
          <PromptFact label='Mode' value={prompt.mode} />
          <PromptFact label='Hash' value={shortHash(prompt.selectedHash ?? prompt.defaultHash)} />
        </dl>
        <p className='text-muted-foreground text-sm'>{prompt.message}</p>
        <p className='rounded-xl bg-amber-500/10 p-3 text-sm text-amber-900 ring-1 ring-amber-500/20 dark:text-amber-100'>
          {prompt.nextAction}
        </p>
      </CardContent>
    </Card>
  );
}

function PromptFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='bg-muted/25 min-w-0 space-y-1 rounded-xl p-3'>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd className='font-semibold break-all'>{value}</dd>
    </div>
  );
}

function promptStatusBadgeVariant(status: StudioPromptStatus): "destructive" | "secondary" {
  if (status === "default-ready" || status === "override-ready") {
    return "secondary";
  }
  return "destructive";
}

function promptStatusLabel(prompt: StudioPromptEntry): string {
  if (prompt.status === "default-ready") {
    return "Default ready";
  }
  if (prompt.status === "override-ready") {
    return "Override active";
  }
  return "Needs action";
}

function shortHash(hash: string | null): string {
  return hash ? hash.slice(0, 12) : "unavailable";
}
