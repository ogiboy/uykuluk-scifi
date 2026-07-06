"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudioActionServiceSummary } from "@/lib/actionServiceStatus";
import {
  actionSurface,
  filterServiceContractGroups,
  serviceBoundaryCopy,
  type ServiceContractAvailabilityFilter,
  type ServiceContractGroup,
} from "@/lib/serviceContractPanel";

type ServiceContractCatalogProps = Readonly<{
  groups: readonly ServiceContractGroup[];
}>;

/**
 * Renders the interactive Studio action contract catalog as a client leaf.
 *
 * @param groups - Server-built action contract groups.
 */
export function ServiceContractCatalog({ groups }: ServiceContractCatalogProps) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<ServiceContractAvailabilityFilter>("all");
  const filteredGroups = useMemo(
    () => filterServiceContractGroups(groups, query, availability),
    [availability, groups, query],
  );
  const visibleCount = filteredGroups.reduce((count, group) => count + group.summaries.length, 0);

  return (
    <div className='grid gap-4'>
      <div className='grid gap-3 rounded-2xl bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end'>
        <div className='grid gap-2'>
          <Label htmlFor='service-contract-search'>Search action contracts</Label>
          <Input
            id='service-contract-search'
            placeholder='render, approval, analytics, publish...'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='service-contract-availability'>Availability</Label>
          <Select
            value={availability}
            onValueChange={(value) => setAvailability(value as ServiceContractAvailabilityFilter)}
          >
            <SelectTrigger className='w-full' id='service-contract-availability'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All actions</SelectItem>
              <SelectItem value='ready-for-cli'>Guarded local</SelectItem>
              <SelectItem value='disabled-external'>Disabled external</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className='rounded-lg bg-background/70 px-3 py-2 text-sm text-muted-foreground'>
          {visibleCount} visible
        </p>
      </div>

      {filteredGroups.length > 0 ? (
        filteredGroups.map((group) => <ServiceContractGroupCard group={group} key={group.title} />)
      ) : (
        <p className='rounded-2xl bg-muted/20 p-4 text-sm text-muted-foreground'>
          No action contracts match the current search. Clear the query or change availability.
        </p>
      )}
    </div>
  );
}

function ServiceContractGroupCard({ group }: Readonly<{ group: ServiceContractGroup }>) {
  return (
    <section className='grid gap-3' aria-label={group.title}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold tracking-tight'>{group.title}</h3>
          <p className='max-w-4xl text-sm text-muted-foreground'>{group.description}</p>
        </div>
        <Badge variant='secondary'>{group.summaries.length}</Badge>
      </div>
      <ServiceContractAccordion summaries={group.summaries} />
    </section>
  );
}

function ServiceContractAccordion({
  summaries,
}: Readonly<{ summaries: readonly StudioActionServiceSummary[] }>) {
  return (
    <Accordion className='rounded-xl bg-muted/20 px-3' type='multiple'>
      {summaries.map((summary) => (
        <AccordionItem className='border-border/40' key={summary.actionId} value={summary.actionId}>
          <AccordionTrigger className='hover:no-underline'>
            <span className='grid min-w-0 gap-1'>
              <span className='flex flex-wrap items-center gap-2'>
                <span className='break-all font-semibold'>{summary.actionId}</span>
                <Badge
                  variant={
                    summary.availability === "disabled-external" ? "destructive" : "secondary"
                  }
                >
                  {summary.availability === "disabled-external" ? "disabled" : "guarded"}
                </Badge>
              </span>
              <span className='text-sm font-normal text-muted-foreground'>
                {summary.description}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ServiceContractDetails summary={summary} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ServiceContractDetails({ summary }: Readonly<{ summary: StudioActionServiceSummary }>) {
  return (
    <div className='grid gap-3 rounded-xl bg-background/70 p-3'>
      <ActionRouteControl summary={summary} />
      <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
      <dl className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-2'>
        <div className='space-y-1 rounded-lg bg-muted/40 p-3'>
          <dt className='font-medium text-foreground'>Route</dt>
          <dd>
            <code className='break-all text-xs text-foreground'>{summary.routePath}</code>
          </dd>
        </div>
        <div className='space-y-1 rounded-lg bg-muted/40 p-3'>
          <dt className='font-medium text-foreground'>Boundary</dt>
          <dd>{serviceBoundaryCopy(summary)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ActionRouteControl({ summary }: Readonly<{ summary: StudioActionServiceSummary }>) {
  if (summary.availability === "ready-for-cli" && summary.routePath !== "unrouted") {
    const surface = actionSurface(summary.actionId);
    return (
      <Link
        className={buttonVariants({ className: "w-full sm:w-fit", variant: "default" })}
        href={surface.href}
      >
        {surface.label}
      </Link>
    );
  }
  return (
    <p className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
      Web execution is disabled for this action.
    </p>
  );
}
