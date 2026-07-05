import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <p className='mb-3 text-sm leading-6 text-muted-foreground [&_a]:text-primary'>
        {inventory.totalFiles} committed file(s) across configured visual asset categories.{" "}
        <Link href='/assets'>Open detailed read-only inventory</Link>.
      </p>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {inventory.categories.slice(0, 6).map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle>
                <h3 className='text-base'>{category.label}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-2 text-sm text-muted-foreground'>
              <p>
                {category.files.length} file(s) · {category.status}
              </p>
              <p>{category.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
