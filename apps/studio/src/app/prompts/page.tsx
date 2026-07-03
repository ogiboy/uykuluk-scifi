import { PromptInventoryView } from "@/components/prompts/PromptInventoryView";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioPromptInventory } from "@/lib/promptInventory";

export const dynamic = "force-dynamic";

/**
 * Renders the runtime prompt inventory page.
 *
 * @returns The read-only prompt inventory page.
 */
export default async function PromptsPage() {
  const inventory = await getStudioPromptInventory();

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only prompt sources</p>
          <h1>Runtime prompt inventory</h1>
        </div>
        <span className='status-pill'>Read-only prompts</span>
      </header>
      <PromptInventoryView inventory={inventory} />
    </StudioShell>
  );
}
