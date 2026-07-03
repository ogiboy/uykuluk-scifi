"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  countStudioRunQueueFilters,
  filterStudioRunQueue,
  type RunQueueFilter,
  runQueueFilterValues,
} from "@/lib/runQueueFilters";
import {
  applyRunQueueWorkbenchControls,
  type RunQueueDensity,
  type RunQueueSort,
  runQueueSortValues,
} from "@/lib/runQueueWorkbench";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { maxBlockedActionSliderValue, RunQueueTunePopover } from "./RunQueueTunePopover";
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

const sortLabels = {
  "blocked-first": "Blocked first",
  "decision-first": "Render decision first",
  "oldest-first": "Oldest first",
  "updated-desc": "Newest first",
} as const satisfies Record<RunQueueSort, string>;

/**
 * Renders a filterable operator queue for persisted Studio runs.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @returns The interactive run queue explorer.
 */
export function RunQueueExplorer({ runs }: RunQueueExplorerProps) {
  const highestBlockedActionCount = Math.max(
    0,
    ...runs.map((run) => Math.min(run.blockedActionCount, maxBlockedActionSliderValue)),
  );
  const [filter, setFilter] = useState<RunQueueFilter>("all");
  const [density, setDensity] = useState<RunQueueDensity>("comfortable");
  const [maxBlockedActions, setMaxBlockedActions] = useState(maxBlockedActionSliderValue);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RunQueueSort>("updated-desc");
  const counts = useMemo(() => countStudioRunQueueFilters(runs), [runs]);
  const matchingRuns = useMemo(
    () => filterStudioRunQueue(runs, { filter, query }),
    [filter, query, runs],
  );
  const filteredRuns = useMemo(
    () =>
      applyRunQueueWorkbenchControls(matchingRuns, {
        maxBlockedActions,
        sort,
      }),
    [matchingRuns, maxBlockedActions, sort],
  );
  const hiddenByBlockerControl = matchingRuns.length - filteredRuns.length;

  return (
    <section className='run-queue-explorer' aria-labelledby='runs-queue-heading'>
      <div className='panel compact-panel'>
        <div className='artifact-preview-header'>
          <div>
            <p className='eyebrow'>Operator queue</p>
            <h2 id='runs-queue-heading'>Find the next safe run action</h2>
          </div>
          <div className='queue-result-badges' aria-label='Queue result summary'>
            <Badge variant='secondary'>{filteredRuns.length} shown</Badge>
            {hiddenByBlockerControl > 0 ? (
              <Badge variant='outline'>{hiddenByBlockerControl} hidden by blocker limit</Badge>
            ) : null}
          </div>
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
          <div className='queue-controls-grid'>
            <label className='queue-search'>
              Search runs
              <Input
                placeholder='run id, state, readiness, next command'
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className='queue-select-control'>
              <Label htmlFor='queue-sort'>Sort queue</Label>
              <Select value={sort} onValueChange={(value) => setSelectedSort(value, setSort)}>
                <SelectTrigger id='queue-sort' aria-label='Sort run queue'>
                  <SelectValue placeholder='Sort queue' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {runQueueSortValues.map((value) => (
                      <SelectItem key={value} value={value}>
                        {sortLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <RunQueueTunePopover
              density={density}
              highestBlockedActionCount={highestBlockedActionCount}
              maxBlockedActions={maxBlockedActions}
              onDensityChange={setDensity}
              onMaxBlockedActionsChange={setMaxBlockedActions}
            />
          </div>
        </div>
        <p>
          Filters are read-only projections over persisted CLI/core run summaries. Approvals and
          render decisions remain on each guarded run detail page.
        </p>
      </div>
      <RunSummaryTable density={density} runs={filteredRuns} />
    </section>
  );
}

function setSelectedFilter(value: string, setFilter: (filter: RunQueueFilter) => void): void {
  if (runQueueFilterValues.includes(value as RunQueueFilter)) {
    setFilter(value as RunQueueFilter);
  }
}

function setSelectedSort(value: string, setSort: (sort: RunQueueSort) => void): void {
  if (runQueueSortValues.includes(value as RunQueueSort)) {
    setSort(value as RunQueueSort);
  }
}
