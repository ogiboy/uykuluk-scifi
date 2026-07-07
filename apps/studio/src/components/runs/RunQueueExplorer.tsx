"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  runQueueEmptyState,
  type RunQueueSort,
  runQueueSortValues,
} from "@/lib/runQueueWorkbench";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { StartIdeasReadinessSummary } from "@/lib/startIdeasReadiness";
import { countStudioActionWorkbench } from "@/lib/studioActionWorkbenchCounts";
import { applyEnumSelectValue } from "@/lib/utils";
import { useMemo, useState } from "react";
import { StartIdeasActionPanel } from "../studio/StartIdeasActionPanel";
import {
  defaultRunQueueDensity,
  defaultRunQueueFilter,
  defaultRunQueueSort,
  filterLabels,
  sortLabels,
} from "./runQueueExplorerOptions";
import { maxBlockedActionSliderValue, RunQueueTunePopover } from "./RunQueueTunePopover";
import { RunSummaryTable } from "./RunSummaryTable";

type RunQueueExplorerProps = Readonly<{
  runs: readonly StudioRunSummary[];
  startIdeasReadiness?: StartIdeasReadinessSummary;
}>;

/**
 * Renders a filterable operator queue for persisted Studio runs.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @param startIdeasReadiness - Optional doctor-derived context for the first-run web action.
 * @returns The interactive run queue explorer.
 */
export function RunQueueExplorer({ runs, startIdeasReadiness }: RunQueueExplorerProps) {
  const highestBlockedActionCount = Math.max(
    0,
    ...runs.map((run) => Math.min(run.blockedActionCount, maxBlockedActionSliderValue)),
  );
  const [filter, setFilter] = useState<RunQueueFilter>(defaultRunQueueFilter);
  const [density, setDensity] = useState<RunQueueDensity>(defaultRunQueueDensity);
  const [maxBlockedActions, setMaxBlockedActions] = useState(maxBlockedActionSliderValue);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RunQueueSort>(defaultRunQueueSort);
  const counts = useMemo(() => countStudioRunQueueFilters(runs), [runs]);
  const matchingRuns = useMemo(
    () => filterStudioRunQueue(runs, { filter, query }),
    [filter, query, runs],
  );
  const filteredRuns = useMemo(
    () => applyRunQueueWorkbenchControls(matchingRuns, { maxBlockedActions, sort }),
    [matchingRuns, maxBlockedActions, sort],
  );
  const actionCounts = useMemo(() => countStudioActionWorkbench(filteredRuns), [filteredRuns]);
  const hiddenByBlockerControl = matchingRuns.length - filteredRuns.length;
  const queueViewIsCustomized =
    density !== defaultRunQueueDensity ||
    filter !== defaultRunQueueFilter ||
    maxBlockedActions !== maxBlockedActionSliderValue ||
    query.trim() !== "" ||
    sort !== defaultRunQueueSort;
  const emptyState = runQueueEmptyState(runs.length, matchingRuns.length, filteredRuns.length);
  const emptyAction =
    runs.length === 0 && startIdeasReadiness ? (
      <StartIdeasActionPanel
        buttonLabel='Start idea run'
        description='Create the first local idea run from Studio while CLI/core keeps provider, budget, and parser guards authoritative.'
        readiness={startIdeasReadiness}
      />
    ) : null;

  function resetQueueView() {
    setDensity(defaultRunQueueDensity);
    setFilter(defaultRunQueueFilter);
    setMaxBlockedActions(maxBlockedActionSliderValue);
    setQuery("");
    setSort(defaultRunQueueSort);
  }

  return (
    <section className='space-y-6' aria-labelledby='runs-queue-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
              Operator queue
            </p>
            <CardTitle id='runs-queue-heading'>Find the next safe run action</CardTitle>
          </div>
          <output
            className='flex flex-wrap items-center gap-2 sm:justify-end'
            aria-label='Queue result summary'
          >
            <Badge variant='secondary'>{filteredRuns.length} shown</Badge>
            {hiddenByBlockerControl > 0 ? (
              <Badge variant='outline'>{hiddenByBlockerControl} hidden by blocker limit</Badge>
            ) : null}
            {actionCounts.webAction > 0 ? (
              <Badge variant='secondary'>{actionCounts.webAction} web action</Badge>
            ) : null}
            {actionCounts.blockedCli > 0 ? (
              <Badge variant='destructive'>{actionCounts.blockedCli} blocked CLI</Badge>
            ) : null}
            {actionCounts.needsReview > 0 ? (
              <Badge variant='outline'>{actionCounts.needsReview} review</Badge>
            ) : null}
            {actionCounts.cliOnly > 0 ? (
              <Badge variant='outline'>{actionCounts.cliOnly} CLI-only</Badge>
            ) : null}
          </output>
        </CardHeader>
        <CardContent className='space-y-5'>
          <ToggleGroup
            className='flex flex-wrap justify-start'
            type='single'
            value={filter}
            variant='outline'
            aria-label='Run queue filter'
            onValueChange={(value) => applyEnumSelectValue(value, runQueueFilterValues, setFilter)}
          >
            {runQueueFilterValues.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {filterLabels[value]} <span>{counts[value]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto] md:items-end'>
            <Label className='grid gap-2'>
              <span>Search runs</span>
              <Input
                placeholder='run id, state, readiness, next command'
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Label>
            <div className='grid gap-2'>
              <Label htmlFor='queue-sort'>Sort queue</Label>
              <Select
                value={sort}
                onValueChange={(value) => applyEnumSelectValue(value, runQueueSortValues, setSort)}
              >
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
            <Button
              disabled={!queueViewIsCustomized}
              onClick={resetQueueView}
              type='button'
              variant='secondary'
            >
              Reset view
            </Button>
          </div>
          <p className='text-muted-foreground text-sm'>
            Filters are read-only projections over persisted CLI/core run summaries. Approvals and
            render decisions remain on each guarded run detail page.
          </p>
        </CardContent>
      </Card>
      <RunSummaryTable
        density={density}
        emptyAction={emptyAction}
        emptyState={emptyState}
        runs={filteredRuns}
      />
    </section>
  );
}
