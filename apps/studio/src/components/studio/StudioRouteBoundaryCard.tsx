import Link from "next/link";
import type { ReactNode } from "react";

type StudioRouteBoundaryAction = Readonly<{
  href: "/" | "/runs";
  label: string;
}>;

type StudioRouteBoundaryCardProps = Readonly<{
  actions: readonly StudioRouteBoundaryAction[];
  children?: ReactNode;
  description: string;
  headingId: string;
  title: string;
}>;

/**
 * Renders safe route-boundary recovery guidance without exposing local filesystem details.
 *
 * @param actions - Safe navigation options that do not mutate producer state.
 * @param children - Optional extra recovery controls, such as a local retry button.
 * @param description - Operator-facing explanation for the boundary state.
 * @param headingId - Stable heading id for the recovery section.
 * @param title - Recovery section heading.
 */
export function StudioRouteBoundaryCard({
  actions,
  children,
  description,
  headingId,
  title,
}: StudioRouteBoundaryCardProps) {
  return (
    <section className='panel' aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <p>{description}</p>
      <div className='studio-header-actions'>
        {children}
        {actions.map((action) => (
          <Link className='status-pill' href={action.href} key={action.href}>
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
