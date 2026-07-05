import { AssetInventoryView } from "@/components/assets/AssetInventoryView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
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
      <StudioPageHeader
        badge='Tracked assets only'
        eyebrow='Read-only production inputs'
        title='Visual asset inventory'
      />
      <AssetInventoryView inventory={inventory} />
    </StudioShell>
  );
}
