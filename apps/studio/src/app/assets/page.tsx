import { AssetInventoryView } from "@/components/assets/AssetInventoryView";
import { getStudioAssetInventory } from "@/lib/assetInventory";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Renders the studio asset inventory page.
 *
 * @returns The asset inventory page content.
 */
export default async function AssetsPage() {
  const inventory = await getStudioAssetInventory();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only production inputs</p>
          <h1>Visual asset inventory</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <AssetInventoryView inventory={inventory} />
    </main>
  );
}
