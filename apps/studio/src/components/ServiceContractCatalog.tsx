"use client";

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
} from "@/lib/actions/serviceContractPanel";
import Link from "next/link";
import { useMemo, useState } from "react";

type ServiceContractCatalogProps = Readonly<{ groups: readonly ServiceContractGroup[] }>;

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
      <div className='bg-muted/20 grid gap-3 rounded-2xl p-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end'>
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
        <p className='bg-background/70 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
          {visibleCount} visible
        </p>
      </div>

      {filteredGroups.length > 0 ? (
        filteredGroups.map((group) => <ServiceContractGroupCard group={group} key={group.title} />)
      ) : (
        <p className='bg-muted/20 text-muted-foreground rounded-2xl p-4 text-sm'>
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
          <p className='text-muted-foreground max-w-4xl text-sm'>{group.description}</p>
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
    <Accordion className='bg-muted/20 rounded-xl px-3' type='multiple'>
      {summaries.map((summary) => (
        <AccordionItem className='border-border/40' key={summary.actionId} value={summary.actionId}>
          <AccordionTrigger className='hover:no-underline'>
            <span className='grid min-w-0 gap-1'>
              <span className='flex flex-wrap items-center gap-2'>
                <span className='font-semibold break-all'>{summary.actionId}</span>
                <Badge
                  variant={
                    summary.availability === "disabled-external" ? "destructive" : "secondary"
                  }
                >
                  {summary.availability === "disabled-external" ? "disabled" : "guarded"}
                </Badge>
              </span>
              <span className='text-muted-foreground text-sm font-normal'>
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
    <div className='bg-background/70 grid gap-3 rounded-xl p-3'>
      <ActionRouteControl summary={summary} />
      <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
      <dl className='text-muted-foreground grid gap-2 text-sm sm:grid-cols-2'>
        <div className='bg-muted/40 space-y-1 rounded-lg p-3'>
          <dt className='text-foreground font-medium'>Route</dt>
          <dd>
            <code className='text-foreground text-xs break-all'>{summary.routePath}</code>
          </dd>
        </div>
        <div className='bg-muted/40 space-y-1 rounded-lg p-3'>
          <dt className='text-foreground font-medium'>Boundary</dt>
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
    <p className='border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
      Web execution is disabled for this action.
    </p>
  );
}
