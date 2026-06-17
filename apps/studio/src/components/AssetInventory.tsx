import { assetGroups } from "@/lib/studioData";

export function AssetInventory() {
  return (
    <section id='assets' aria-labelledby='asset-heading'>
      <h2 id='asset-heading'>Asset Inventory</h2>
      <div className='asset-grid'>
        {assetGroups.map((group) => (
          <article className='panel' key={group.label}>
            <h3>{group.label}</h3>
            <p>{group.count}</p>
            <p>{group.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
