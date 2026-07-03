import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { StudioShell } from "@/components/studio/StudioShell";

/**
 * Renders the Studio route-level not-found boundary.
 *
 * @returns Safe recovery guidance for unknown Studio routes or missing local run resources.
 */
export default function StudioNotFoundPage() {
  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Route boundary</p>
          <h1>Studio route not found</h1>
        </div>
        <span className='status-pill blocked'>No action taken</span>
      </header>

      <StudioRouteBoundaryCard
        actions={[
          { href: "/runs", label: "Open run queue" },
          { href: "/", label: "Open Studio home" },
        ]}
        description='Studio could not find this page or local run resource. Missing routes and missing files never imply approval, readiness, upload permission, or publish permission.'
        headingId='studio-not-found-recovery-heading'
        title='Safe next step'
      />
    </StudioShell>
  );
}
