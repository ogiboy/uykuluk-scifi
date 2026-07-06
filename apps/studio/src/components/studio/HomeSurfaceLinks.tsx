import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  buildHomeSurfaces,
  type HomeSurfaceLinksProps,
  type SurfaceTone,
} from "@/components/studio/home/homeSurfaces";

type BadgeVariant = "destructive" | "outline" | "secondary";

/**
 * Renders the compact route index for secondary Studio surfaces.
 *
 * @param props - Current Studio route summaries used to label each destination.
 * @returns A small operator route index that keeps the home page focused on current work.
 */
export function HomeSurfaceLinks({
  actionStatus,
  analyticsOverview,
  assetInventory,
  doctorOverview,
  ideaHistoryOverview,
  modelEvalOverview,
  promptInventory,
  runs,
}: HomeSurfaceLinksProps) {
  const surfaces = buildHomeSurfaces({
    actionStatus,
    analyticsOverview,
    assetInventory,
    doctorOverview,
    ideaHistoryOverview,
    modelEvalOverview,
    promptInventory,
    runs,
  });

  return (
    <section
      aria-labelledby='studio-surfaces-heading'
      className='rounded-2xl bg-card/55 p-5 shadow-sm shadow-black/10'
    >
      <div className='grid gap-3 pb-4 sm:grid-cols-[1fr_auto] sm:items-end'>
        <div className='space-y-1'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
            Detail routes
          </p>
          <h2 className='text-xl font-semibold tracking-tight' id='studio-surfaces-heading'>
            Open focused operator pages when you need deeper proof.
          </h2>
        </div>
        <Link className={buttonVariants({ variant: "secondary" })} href='/actions'>
          See guarded actions
        </Link>
      </div>

      <ul className='grid gap-3 md:grid-cols-2 xl:grid-cols-3' aria-label='Studio operator pages'>
        {surfaces.map((surface) => (
          <li className='min-w-0 rounded-xl bg-background/45 p-4' key={surface.href}>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
              <div className='min-w-0 space-y-1'>
                <h3 className='truncate text-sm font-semibold' title={surface.label}>
                  {surface.label}
                </h3>
                <p className='text-xs text-muted-foreground'>{surface.metric}</p>
              </div>
              <Badge variant={badgeVariant(surface.tone)}>{surface.status}</Badge>
            </div>
            <p className='mt-3 min-h-10 text-sm text-muted-foreground'>{surface.detail}</p>
            <Link
              className='mt-3 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline'
              href={surface.href}
            >
              Open {surface.label.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function badgeVariant(tone: SurfaceTone): BadgeVariant {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "passing") {
    return "secondary";
  }
  return "outline";
}
