import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StartIdeasReadinessSummary } from "@/lib/startIdeasReadiness";
import { StartIdeasActionPanel } from "./StartIdeasActionPanel";

type EmptyRunCardProps = Readonly<{ readiness: StartIdeasReadinessSummary }>;

/**
 * Renders the first-run empty state with guarded local idea generation.
 *
 * @param readiness - Read-only doctor-derived provider readiness guidance.
 * @returns The empty queue card for Studio home.
 */
export function EmptyRunCard({ readiness }: EmptyRunCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>No local runs yet</h3>
        </CardTitle>
        <CardDescription>
          Start with a safe local idea run. Studio will show the persisted run queue, evidence,
          readiness, and guarded approval actions once CLI/core creates the run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StartIdeasActionPanel readiness={readiness} />
      </CardContent>
    </Card>
  );
}
