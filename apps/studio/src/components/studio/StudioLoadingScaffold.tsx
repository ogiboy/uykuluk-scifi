import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { studioSections } from "@/lib/studioData";

import { StudioBrandLockup } from "./StudioBrandLockup";
import {
  studioMainClassName,
  studioRailClassName,
  studioShellClassName,
} from "./studioShellClasses";

type StudioLoadingScaffoldProps = Readonly<{
  eyebrow: string;
  layout?: "full" | "shell";
  railPanels?: number;
  title: string;
}>;

const metricSkeletons = ["state", "readiness", "evidence", "decision"] as const;
const panelSkeletons = ["doctor", "model", "readiness", "analytics"] as const;

/**
 * Renders a semantic loading shell for Studio route-level data boundaries.
 *
 * @param eyebrow - Compact route context shown above the heading.
 * @param layout - Whether to include the Studio navigation rail.
 * @param railPanels - Number of right-rail placeholder panels to render.
 * @param title - Route heading that remains visible while local data loads.
 */
export function StudioLoadingScaffold({
  eyebrow,
  layout = "full",
  railPanels = 2,
  title,
}: StudioLoadingScaffoldProps) {
  if (layout === "shell") {
    return (
      <main className={studioShellClassName} aria-busy='true' aria-live='polite'>
        <StudioLoadingRail />
        <StudioLoadingMain eyebrow={eyebrow} railPanels={railPanels} title={title} />
      </main>
    );
  }
  return (
    <main className={`${studioMainClassName} min-h-screen`} aria-busy='true' aria-live='polite'>
      <StudioLoadingContent eyebrow={eyebrow} railPanels={railPanels} title={title} />
    </main>
  );
}

function StudioLoadingRail() {
  return (
    <aside className={studioRailClassName} aria-label='Studio navigation loading state'>
      <StudioBrandLockup />
      <nav className='grid gap-2' aria-label='Loading Studio navigation'>
        {studioSections.map((section) => (
          <span
            className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground'
            key={section.id}
          >
            {section.label}
          </span>
        ))}
      </nav>
    </aside>
  );
}

function StudioLoadingMain({
  eyebrow,
  railPanels,
  title,
}: Readonly<{ eyebrow: string; railPanels: number; title: string }>) {
  return (
    <section className={studioMainClassName}>
      <StudioLoadingContent eyebrow={eyebrow} railPanels={railPanels} title={title} />
    </section>
  );
}

function StudioLoadingContent({
  eyebrow,
  railPanels,
  title,
}: Readonly<{ eyebrow: string; railPanels: number; title: string }>) {
  const railPanelKeys = Array.from({ length: railPanels }, (_, index) => `rail-${index}`);
  return (
    <>
      <header className='grid gap-4 border-b pb-6 sm:grid-cols-[1fr_auto] sm:items-start'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
            {eyebrow}
          </p>
          <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>{title}</h1>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
          <Skeleton className='h-10 w-60 rounded-md' />
          <Skeleton className='h-7 w-36 rounded-full' />
        </div>
      </header>

      <section
        className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]'
        aria-label='Loading operator control desk'
      >
        <div className='grid gap-4'>
          <div className='grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start'>
            <div className='space-y-3'>
              <Skeleton className='h-3 w-40 rounded-full' />
              <Skeleton className='h-7 w-80 max-w-full rounded-md' />
            </div>
            <Skeleton className='h-7 w-28 rounded-full' />
          </div>
          <Card className='border-dashed'>
            <CardHeader className='space-y-3'>
              <Skeleton className='h-3 w-32 rounded-full' />
              <Skeleton className='h-8 w-72 max-w-full rounded-md' />
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                {metricSkeletons.map((metric) => (
                  <div className='space-y-2' key={metric}>
                    <Skeleton className='h-3 w-24 rounded-full' />
                    <Skeleton className='h-5 w-28 rounded-md' />
                  </div>
                ))}
              </div>
              <Skeleton className='h-24 w-full rounded-lg' />
            </CardContent>
          </Card>
        </div>
        <aside className='grid content-start gap-4' aria-label='Loading safety rail'>
          {railPanelKeys.map((panelKey) => (
            <LoadingPanel key={panelKey} />
          ))}
        </aside>
      </section>

      <section
        className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'
        aria-label='Loading Studio status panels'
      >
        {panelSkeletons.map((panel) => (
          <Card key={panel}>
            <CardContent className='space-y-3 pt-6'>
              <Skeleton className='h-3 w-24 rounded-full' />
              <Skeleton className='h-6 w-32 rounded-md' />
              <Skeleton className='h-12 w-full rounded-lg' />
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}

function LoadingPanel() {
  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <Skeleton className='h-6 w-44 max-w-full rounded-md' />
        <Skeleton className='h-4 w-full rounded-md' />
        <Skeleton className='h-4 w-2/3 rounded-md' />
      </CardContent>
    </Card>
  );
}
