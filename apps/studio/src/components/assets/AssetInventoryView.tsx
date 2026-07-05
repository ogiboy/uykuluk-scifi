import type {
  StudioAssetCategory,
  StudioAssetCategoryStatus,
  StudioAssetInventory,
} from "@/lib/assetInventory";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
    <div className='grid gap-4'>
      <section aria-labelledby='asset-overview-heading'>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id='asset-overview-heading'>Inventory Overview</h2>
            </CardTitle>
            <CardDescription>
              Read-only view of committed local assets and configured guard directories. This page
              does not approve assets, render media, upload, publish, or mutate run state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssetMetadataGrid
              items={[
                { label: "Status", value: inventory.passed ? "ready" : "needs review" },
                { label: "Files", value: inventory.totalFiles },
                { label: "Config", value: inventory.configValid ? "valid" : "invalid" },
                { label: "Source", value: inventory.configSource },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='asset-warning-heading'>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id='asset-warning-heading'>Guard Warnings</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.warnings.length > 0 ? (
              <ul className='grid gap-2 text-sm text-muted-foreground'>
                {inventory.warnings.map((warning, index) => (
                  <li
                    className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100'
                    key={listKey("inventory-warning", warning, index)}
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-muted-foreground'>No configured asset guard warnings.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className='grid gap-4 lg:grid-cols-2' aria-label='Asset categories'>
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
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle>
              <h2 className='text-base'>{category.label}</h2>
            </CardTitle>
            <CardDescription className='break-all font-mono text-xs'>
              {category.directory}
            </CardDescription>
          </div>
          <Badge variant={statusBadgeVariant(category.status)}>
            {statusLabel(category.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <p className='text-sm text-muted-foreground'>{category.description}</p>
        <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
          {category.requiredFor}
        </p>
        <p className='text-xs text-muted-foreground'>
          {category.files.length} file(s)
          {category.guarded
            ? " · guarded by producer doctor/readiness checks"
            : " · inventory only"}
        </p>
        {category.warnings.length > 0 ? (
          <ul className='grid gap-2 text-sm text-muted-foreground'>
            {category.warnings.map((warning, index) => (
              <li key={listKey(`${category.id}-warning`, warning, index)}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <ul className='grid max-h-44 list-disc gap-1 overflow-auto rounded-md border bg-muted/20 py-2 pl-6 pr-3 font-mono text-xs leading-relaxed text-muted-foreground'>
          {category.files.map((file, index) => (
            <li key={listKey(`${category.id}-file`, file, index)}>{file}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Maps a category status to its badge variant.
 *
 * @param status - The category status.
 * @returns The shadcn badge variant for the status.
 */
function statusBadgeVariant(status: StudioAssetCategoryStatus): "destructive" | "secondary" {
  if (status === "ready") {
    return "secondary";
  }
  return "destructive";
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

function AssetMetadataGrid({
  items,
}: Readonly<{ items: readonly { label: string; value: number | string }[] }>) {
  return (
    <dl className='grid gap-3 sm:grid-cols-2'>
      {items.map((item) => (
        <div className='rounded-lg border bg-muted/20 p-3' key={item.label}>
          <dt className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {item.label}
          </dt>
          <dd className='mt-1 break-words text-sm'>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
