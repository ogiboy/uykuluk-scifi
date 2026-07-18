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
import type { StudioLocale } from "@/i18n/locales";
import { countStudioActionWorkbench } from "@/lib/actions/studioActionWorkbenchCounts";
import {
  countStudioRunQueueFilters,
  filterStudioRunQueue,
  type RunQueueFilter,
  runQueueFilterValues,
} from "@/lib/runs/runQueueFilters";
import {
  applyRunQueueWorkbenchControls,
  type RunQueueDensity,
  type RunQueueSort,
  runQueueSortValues,
} from "@/lib/runs/runQueueWorkbench";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { applyEnumSelectValue } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";
import { runQueueCopy } from "./runQueueCopy";
import {
  defaultRunQueueDensity,
  defaultRunQueueFilter,
  defaultRunQueueSort,
} from "./runQueueExplorerOptions";
import { maxBlockedActionSliderValue, RunQueueTunePopover } from "./RunQueueTunePopover";
import { RunSummaryTable } from "./RunSummaryTable";

type RunQueueExplorerProps = Readonly<{ locale: StudioLocale; runs: readonly StudioRunSummary[] }>;

/**
 * Renders a filterable operator queue for persisted Studio runs.
 *
 * @param locale - The active Studio locale for operator-facing queue copy.
 * @param runs - Persisted local run summaries, newest first.
 * @returns The interactive run queue explorer.
 */
export function RunQueueExplorer({ locale, runs }: RunQueueExplorerProps) {
  const copy = runQueueCopy(locale);
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
  const emptyAction =
    runs.length === 0 ? (
      <Button asChild>
        <Link href='/ideas/new'>{copy.createEpisode}</Link>
      </Button>
    ) : null;
  const localizedEmptyState = runs.length === 0 ? copy.emptyRuns : copy.emptyFiltered;

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
              {copy.operatorQueue}
            </p>
            <CardTitle id='runs-queue-heading'>
              {locale === "tr"
                ? "Sonraki güvenli bölüm adımını bulun"
                : "Find the next safe episode action"}
            </CardTitle>
          </div>
          <output
            className='flex flex-wrap items-center gap-2 sm:justify-end'
            aria-label={copy.queueResultSummary}
          >
            <Badge variant='secondary'>{copy.shown(filteredRuns.length)}</Badge>
            {hiddenByBlockerControl > 0 ? (
              <Badge variant='outline'>{copy.hiddenByBlocker(hiddenByBlockerControl)}</Badge>
            ) : null}
            {actionCounts.webAction > 0 ? (
              <Badge variant='secondary'>{copy.webAction(actionCounts.webAction)}</Badge>
            ) : null}
            {actionCounts.blockedCli > 0 ? (
              <Badge variant='destructive'>{copy.blockedCli(actionCounts.blockedCli)}</Badge>
            ) : null}
            {actionCounts.needsReview > 0 ? (
              <Badge variant='outline'>{copy.review(actionCounts.needsReview)}</Badge>
            ) : null}
            {actionCounts.cliOnly > 0 ? <Badge variant='outline'>{copy.cliOnly}</Badge> : null}
          </output>
        </CardHeader>
        <CardContent className='space-y-5'>
          <ToggleGroup
            className='flex flex-wrap justify-start'
            type='single'
            value={filter}
            variant='outline'
            aria-label={copy.operatorQueue}
            onValueChange={(value) => applyEnumSelectValue(value, runQueueFilterValues, setFilter)}
          >
            {runQueueFilterValues.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {copy.filters[value]} <span>{counts[value]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto] md:items-end'>
            <Label className='grid gap-2'>
              <span>{copy.searchLabel}</span>
              <Input
                placeholder={copy.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Label>
            <div className='grid gap-2'>
              <Label htmlFor='queue-sort'>{copy.sortLabel}</Label>
              <Select
                value={sort}
                onValueChange={(value) => applyEnumSelectValue(value, runQueueSortValues, setSort)}
              >
                <SelectTrigger id='queue-sort' aria-label={copy.sortLabel}>
                  <SelectValue placeholder={copy.sortPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {runQueueSortValues.map((value) => (
                      <SelectItem key={value} value={value}>
                        {copy.sorts[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <RunQueueTunePopover
              density={density}
              highestBlockedActionCount={highestBlockedActionCount}
              locale={locale}
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
              {copy.resetView}
            </Button>
          </div>
          <p className='text-muted-foreground text-sm'>{copy.summary}</p>
        </CardContent>
      </Card>
      <RunSummaryTable
        density={density}
        emptyAction={emptyAction}
        emptyState={localizedEmptyState}
        locale={locale}
        runs={filteredRuns}
      />
    </section>
  );
}
