import type {
  StudioAssetCategory,
  StudioAssetCategoryStatus,
  StudioAssetInventory,
} from "@/lib/assetInventory";

type AssetInventoryViewProps = Readonly<{
  inventory: StudioAssetInventory;
}>;

/**
 * Renders a read-only overview of an asset inventory.
 *
 * @param inventory - The asset inventory data to display.
 * @returns The inventory overview, guard warnings, and asset category cards.
 */
export function AssetInventoryView({ inventory }: AssetInventoryViewProps) {
  return (
    <div className='asset-detail-grid'>
      <section className='panel asset-overview' aria-labelledby='asset-overview-heading'>
        <h2 id='asset-overview-heading'>Inventory Overview</h2>
        <dl className='run-metadata'>
          <div>
            <dt>Status</dt>
            <dd>{inventory.passed ? "ready" : "needs review"}</dd>
          </div>
          <div>
            <dt>Files</dt>
            <dd>{inventory.totalFiles}</dd>
          </div>
          <div>
            <dt>Config</dt>
            <dd>{inventory.configValid ? "valid" : "invalid"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{inventory.configSource}</dd>
          </div>
        </dl>
        <p>
          Read-only view of committed local assets and configured guard directories. This page does
          not approve assets, render media, upload, publish, or mutate run state.
        </p>
      </section>

      <section className='panel' aria-labelledby='asset-warning-heading'>
        <h2 id='asset-warning-heading'>Guard Warnings</h2>
        {inventory.warnings.length > 0 ? (
          <ul className='plain-list'>
            {inventory.warnings.map((warning, index) => (
              <li key={listKey("inventory-warning", warning, index)}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No configured asset guard warnings.</p>
        )}
      </section>

      <section className='asset-categories' aria-label='Asset categories'>
        {inventory.categories.map((category) => (
          <AssetCategoryCard category={category} key={category.id} />
        ))}
      </section>
    </div>
  );
}

/**
 * Renders an asset category card with its metadata, warnings, and file list.
 *
 * @param category - The category to display.
 */
function AssetCategoryCard({ category }: Readonly<{ category: StudioAssetCategory }>) {
  return (
    <article className='panel asset-category-card'>
      <div className='artifact-preview-header'>
        <div>
          <h2>{category.label}</h2>
          <p className='artifact-meta'>{category.directory}</p>
        </div>
        <span className={statusClassName(category.status)}>{statusLabel(category.status)}</span>
      </div>
      <p>{category.description}</p>
      <p className='artifact-action'>{category.requiredFor}</p>
      <p className='artifact-meta'>
        {category.files.length} file(s)
        {category.guarded ? " · guarded by producer doctor/readiness checks" : " · inventory only"}
      </p>
      {category.warnings.length > 0 ? (
        <ul className='plain-list'>
          {category.warnings.map((warning, index) => (
            <li key={listKey(`${category.id}-warning`, warning, index)}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <ul className='asset-file-list'>
        {category.files.map((file, index) => (
          <li key={listKey(`${category.id}-file`, file, index)}>{file}</li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Maps a category status to its CSS class name.
 *
 * @param status - The category status.
 * @returns The CSS class name for the status pill.
 */
function statusClassName(status: StudioAssetCategoryStatus): string {
  if (status === "ready") {
    return "status-pill small";
  }
  return "status-pill small blocked";
}

/**
 * Formats a category status for display.
 *
 * @param status - The category status value.
 * @returns The user-facing status label.
 */
function statusLabel(status: StudioAssetCategoryStatus): string {
  if (status === "needs-action") {
    return "needs action";
  }
  return status;
}

/**
 * Builds a React list key from display text plus a stable local discriminator.
 *
 * @param scope - The list scope where the key is used.
 * @param value - The displayed list value.
 * @param index - The item index, used only to disambiguate repeated display values.
 * @returns A key that remains unique even when operator-facing text repeats.
 */
function listKey(scope: string, value: string, index: number): string {
  return `${scope}-${index}-${value}`;
}
