import { PromptInventoryView } from "@/components/prompts/PromptInventoryView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
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
      <StudioPageHeader
        badge='Read-only prompts'
        eyebrow='Read-only prompt sources'
        title='Runtime prompt inventory'
      />
      <PromptInventoryView inventory={inventory} />
    </StudioShell>
  );
}
