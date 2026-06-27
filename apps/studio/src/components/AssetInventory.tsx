import type { StudioAssetInventory } from "@/lib/assetInventory";

/**
 * Renders a summary of the asset inventory and its first six categories.
 *
 * @param inventory - The asset inventory data to display.
 */
export function AssetInventory({ inventory }: Readonly<{ inventory: StudioAssetInventory }>) {
  return (
    <section id='assets' aria-labelledby='asset-heading'>
      <h2 id='asset-heading'>Asset Inventory</h2>
      <p className='section-copy'>
        {inventory.totalFiles} committed file(s) across configured visual asset categories.{" "}
        <a href='/assets'>Open detailed read-only inventory</a>.
      </p>
      <div className='asset-grid'>
        {inventory.categories.slice(0, 6).map((category) => (
          <article className='panel' key={category.id}>
            <h3>{category.label}</h3>
            <p>
              {category.files.length} file(s) · {category.status}
            </p>
            <p>{category.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
