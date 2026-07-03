import { AssetInventoryView } from "@/components/assets/AssetInventoryView";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioAssetInventory } from "@/lib/assetInventory";

export const dynamic = "force-dynamic";

/**
 * Renders the studio asset inventory page.
 *
 * @returns The asset inventory page content.
 */
export default async function AssetsPage() {
  const inventory = await getStudioAssetInventory();

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only production inputs</p>
          <h1>Visual asset inventory</h1>
        </div>
        <span className='status-pill'>Tracked assets only</span>
      </header>
      <AssetInventoryView inventory={inventory} />
    </StudioShell>
  );
}
