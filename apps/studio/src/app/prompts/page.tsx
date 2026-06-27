import { PromptInventoryView } from "@/components/prompts/PromptInventoryView";
import { getStudioPromptInventory } from "@/lib/promptInventory";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Renders the runtime prompt inventory page.
 *
 * @returns The read-only prompt inventory page.
 */
export default async function PromptsPage() {
  const inventory = await getStudioPromptInventory();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only prompt sources</p>
          <h1>Runtime prompt inventory</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <PromptInventoryView inventory={inventory} />
    </main>
  );
}
