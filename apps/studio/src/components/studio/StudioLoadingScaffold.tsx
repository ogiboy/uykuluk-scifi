import { Skeleton } from "@/components/ui/skeleton";
import { studioSections } from "@/lib/studioData";

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
      <main className='studio-shell' aria-busy='true' aria-live='polite'>
        <StudioLoadingRail />
        <StudioLoadingMain eyebrow={eyebrow} railPanels={railPanels} title={title} />
      </main>
    );
  }
  return (
    <main className='studio-main page-shell' aria-busy='true' aria-live='polite'>
      <StudioLoadingContent eyebrow={eyebrow} railPanels={railPanels} title={title} />
    </main>
  );
}

function StudioLoadingRail() {
  return (
    <aside className='studio-rail' aria-label='Studio navigation loading state'>
      <div className='brand-lockup'>
        <span className='brand-mark'>USF</span>
        <div>
          <p>UykulukSciFi</p>
          <strong>Producer Studio</strong>
        </div>
      </div>
      <nav aria-label='Loading Studio navigation'>
        {studioSections.map((section) => (
          <span className='studio-loading-nav-item' key={section.id}>
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
    <section className='studio-main'>
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
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className='studio-header-actions'>
          <Skeleton className='studio-loading-command' />
          <Skeleton className='studio-loading-pill' />
        </div>
      </header>

      <section className='control-desk' aria-label='Loading operator control desk'>
        <div className='control-desk-primary'>
          <div className='control-desk-heading'>
            <div>
              <Skeleton className='studio-loading-line short' />
              <Skeleton className='studio-loading-line heading' />
            </div>
            <Skeleton className='studio-loading-pill small' />
          </div>
          <article className='active-run-card studio-loading-panel'>
            <Skeleton className='studio-loading-line label' />
            <Skeleton className='studio-loading-line title' />
            <div className='run-metadata'>
              {metricSkeletons.map((metric) => (
                <div key={metric}>
                  <Skeleton className='studio-loading-line label' />
                  <Skeleton className='studio-loading-line value' />
                </div>
              ))}
            </div>
            <Skeleton className='studio-loading-command wide' />
          </article>
        </div>
        <aside className='control-desk-rail' aria-label='Loading safety rail'>
          {railPanelKeys.map((panelKey) => (
            <LoadingPanel key={panelKey} />
          ))}
        </aside>
      </section>

      <div className='status-grid' aria-label='Loading Studio status panels'>
        {panelSkeletons.map((panel) => (
          <article className='status-card' key={panel}>
            <Skeleton className='studio-loading-line label' />
            <Skeleton className='studio-loading-line value' />
            <Skeleton className='studio-loading-line body' />
          </article>
        ))}
      </div>
    </>
  );
}

function LoadingPanel() {
  return (
    <section className='panel compact-panel'>
      <Skeleton className='studio-loading-line heading' />
      <Skeleton className='studio-loading-line body' />
      <Skeleton className='studio-loading-line body narrow' />
    </section>
  );
}
