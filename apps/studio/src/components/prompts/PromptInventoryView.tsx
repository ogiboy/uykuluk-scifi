import type {
  StudioPromptEntry,
  StudioPromptInventory,
  StudioPromptStatus,
} from "@/lib/promptInventoryTypes";
import { Badge } from "../ui/badge";

export function PromptInventoryView({ inventory }: Readonly<{ inventory: StudioPromptInventory }>) {
  return (
    <section className='prompt-inventory' aria-labelledby='prompt-inventory-heading'>
      <div>
        <h3 id='prompt-inventory-heading'>Runtime prompt inventory</h3>
        <p>
          Read-only prompt source visibility. Studio does not edit prompts, approve prompt changes,
          call providers, or make `.ai/` part of runtime.
        </p>
      </div>
      <dl className='run-metadata'>
        <div>
          <dt>Config</dt>
          <dd>{inventory.configSource}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{inventory.passed ? "Ready" : "Needs action"}</dd>
        </div>
      </dl>
      {inventory.warnings.length > 0 ? (
        <ul className='plain-list'>
          {inventory.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p>No prompt inventory warnings.</p>
      )}
      <div className='prompt-card-grid'>
        {inventory.prompts.map((prompt) => (
          <PromptInventoryCard key={prompt.key} prompt={prompt} />
        ))}
      </div>
    </section>
  );
}

function PromptInventoryCard({ prompt }: Readonly<{ prompt: StudioPromptEntry }>) {
  return (
    <article className='prompt-card'>
      <header className='artifact-preview-header'>
        <div>
          <strong>{prompt.label}</strong>
          <span>{prompt.contractMarker}</span>
        </div>
        <Badge variant={promptStatusBadgeVariant(prompt.status)}>{promptStatusLabel(prompt)}</Badge>
      </header>
      <dl className='run-metadata'>
        <div>
          <dt>Default</dt>
          <dd>{prompt.defaultPath}</dd>
        </div>
        <div>
          <dt>Selected</dt>
          <dd>{prompt.selectedPath ?? "none"}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{prompt.mode}</dd>
        </div>
        <div>
          <dt>Hash</dt>
          <dd>{shortHash(prompt.selectedHash ?? prompt.defaultHash)}</dd>
        </div>
      </dl>
      <p>{prompt.message}</p>
      <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
        {prompt.nextAction}
      </p>
    </article>
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
