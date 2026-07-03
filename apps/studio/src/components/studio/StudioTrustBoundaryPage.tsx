import { StudioRouteBoundaryCard } from "./StudioRouteBoundaryCard";
import { StudioShell } from "./StudioShell";

type StudioTrustBoundaryPageProps = Readonly<{
  description: string;
  eyebrow: string;
  headingId: string;
  statusLabel: string;
  title: string;
}>;

/**
 * Renders stable Studio trust-boundary pages without enabling experimental Next auth interrupts.
 *
 * @param description - Operator-facing recovery guidance for the boundary.
 * @param eyebrow - Compact route context shown above the heading.
 * @param headingId - Stable heading id for the recovery card.
 * @param statusLabel - Non-mutating status text shown in the route header.
 * @param title - Boundary page title.
 */
export function StudioTrustBoundaryPage({
  description,
  eyebrow,
  headingId,
  statusLabel,
  title,
}: StudioTrustBoundaryPageProps) {
  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <span className='status-pill blocked'>{statusLabel}</span>
      </header>

      <StudioRouteBoundaryCard
        actions={[
          { href: "/runs", label: "Open run queue" },
          { href: "/", label: "Open Studio home" },
        ]}
        description={description}
        headingId={headingId}
        title='Safe recovery'
      />
    </StudioShell>
  );
}
