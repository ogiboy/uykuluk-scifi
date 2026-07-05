import {
  defaultStudioRouteBoundaryActions,
  StudioRouteBoundaryCard,
  StudioRouteBoundaryHeader,
  type StudioRouteBoundaryAction,
} from "./StudioRouteBoundaryCard";
import { StudioShell } from "./StudioShell";
import type { StudioRouteBoundaryCopy } from "@/lib/studioRouteBoundaryCopy";

type StudioTrustBoundaryPageProps = Readonly<{
  copy: StudioRouteBoundaryCopy;
}>;

/**
 * Renders stable Studio trust-boundary pages without enabling experimental Next auth interrupts.
 *
 * @param copy - Operator-facing boundary copy shared with route tests.
 */
export function StudioTrustBoundaryPage({ copy }: StudioTrustBoundaryPageProps) {
  return (
    <StudioShell>
      <StudioRouteBoundaryHeader copy={copy} />

      <StudioRouteBoundaryCard
        actions={studioTrustBoundaryActions(copy)}
        description={copy.description}
        headingId={copy.recoveryHeadingId}
        title={copy.recoveryTitle}
      />
    </StudioShell>
  );
}

function studioTrustBoundaryActions(
  copy: StudioRouteBoundaryCopy,
): readonly StudioRouteBoundaryAction[] {
  if (!copy.primaryActionHref || !copy.primaryActionLabel) {
    return defaultStudioRouteBoundaryActions;
  }
  return [
    {
      href: copy.primaryActionHref,
      label: copy.primaryActionLabel,
    },
    ...defaultStudioRouteBoundaryActions.filter((action) => action.href !== copy.primaryActionHref),
  ];
}
