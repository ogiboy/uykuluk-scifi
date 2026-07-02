"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  countStudioRunQueueFilters,
  filterStudioRunQueue,
  type RunQueueFilter,
  runQueueFilterValues,
} from "@/lib/runQueueFilters";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { RunSummaryTable } from "./RunSummaryTable";

type RunQueueExplorerProps = Readonly<{
  runs: readonly StudioRunSummary[];
}>;

const filterLabels = {
  all: "All",
  attention: "Needs attention",
  ready: "Ready evidence",
  rendered: "Rendered",
  decision: "Needs decision",
} as const satisfies Record<RunQueueFilter, string>;

/**
 * Renders a filterable operator queue for persisted Studio runs.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @returns The interactive run queue explorer.
 */
export function RunQueueExplorer({ runs }: RunQueueExplorerProps) {
  const [filter, setFilter] = useState<RunQueueFilter>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => countStudioRunQueueFilters(runs), [runs]);
  const filteredRuns = useMemo(
    () => filterStudioRunQueue(runs, { filter, query }),
    [filter, query, runs],
  );

  return (
    <section className='run-queue-explorer' aria-labelledby='runs-queue-heading'>
      <div className='panel compact-panel'>
        <div className='artifact-preview-header'>
          <div>
            <p className='eyebrow'>Operator queue</p>
            <h2 id='runs-queue-heading'>Find the next safe run action</h2>
          </div>
          <span className='status-pill small'>{filteredRuns.length} shown</span>
        </div>
        <div className='queue-toolbar'>
          <ToggleGroup
            className='segmented-filter'
            type='single'
            value={filter}
            variant='outline'
            aria-label='Run queue filter'
            onValueChange={(value) => setSelectedFilter(value, setFilter)}
          >
            {runQueueFilterValues.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {filterLabels[value]} <span>{counts[value]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <label className='queue-search'>
            Search runs
            <Input
              placeholder='run id, state, readiness, next command'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <p>
          Filters are read-only projections over persisted CLI/core run summaries. Approvals and
          render decisions remain on each guarded run detail page.
        </p>
      </div>
      <RunSummaryTable runs={filteredRuns} />
    </section>
  );
}

function setSelectedFilter(value: string, setFilter: (filter: RunQueueFilter) => void): void {
  if (runQueueFilterValues.includes(value as RunQueueFilter)) {
    setFilter(value as RunQueueFilter);
  }
}
