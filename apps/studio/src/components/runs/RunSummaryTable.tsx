"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StudioLocale } from "@/i18n/locales";
import type { RunQueueDensity } from "@/lib/runs/runQueueWorkbench";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { runQueueCopy } from "./runQueueCopy";
import { runColumnClassName, runSummaryColumns } from "./RunSummaryTableColumns";
import {
  ColumnVisibilityMenu,
  RunSortableHeader,
  RunTableCell,
  RunTablePagination,
} from "./RunSummaryTableControls";

type RunSummaryTableProps = Readonly<{
  density?: RunQueueDensity;
  emptyAction?: ReactNode;
  emptyState?: Readonly<{ heading: string; message: string }>;
  locale: StudioLocale;
  runs: readonly StudioRunSummary[];
}>;

const initialColumnVisibility = {
  channelHandoff: false,
  finalBundle: false,
  nextAction: false,
} as const satisfies VisibilityState;

const initialPagination = { pageIndex: 0, pageSize: 10 } as const satisfies PaginationState;

/**
 * Displays a TanStack-powered summary grid of saved producer runs.
 *
 * @param density - The operator-selected table density.
 * @param runs - The runs to display
 */
export function RunSummaryTable({
  density = "comfortable",
  emptyAction,
  emptyState,
  locale,
  runs,
}: RunSummaryTableProps) {
  const copy = runQueueCopy(locale);
  const resolvedEmptyState = emptyState ?? copy.emptyRuns;
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnVisibility);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => [...runs], [runs]);
  const columns = useMemo(() => runSummaryColumns(locale), [locale]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is the selected headless grid engine; the table instance is kept local to this component.
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (run) => run.runId,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { columnVisibility, pagination, sorting },
  });
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const visibleRows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  useEffect(() => {
    setPagination((current) => {
      if (current.pageIndex === 0) {
        return current;
      }
      return { ...current, pageIndex: 0 };
    });
  }, [runs]);

  if (runs.length === 0) {
    return (
      <section aria-labelledby='runs-empty-heading'>
        <Card>
          <CardHeader>
            <CardTitle id='runs-empty-heading'>{resolvedEmptyState.heading}</CardTitle>
            <CardDescription>{resolvedEmptyState.message}</CardDescription>
          </CardHeader>
          {emptyAction ? <CardContent>{emptyAction}</CardContent> : null}
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby='runs-index-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='runs-index-heading'>{copy.indexTitle}</CardTitle>
            <CardDescription>{copy.indexDescription}</CardDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
            <Badge variant='secondary'>{copy.rows(visibleRows.length, totalRows)}</Badge>
            <ColumnVisibilityMenu locale={locale} table={table} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Table
            className={`min-w-230 max-[1100px]:min-w-160 ${density === "compact" ? "text-xs" : ""}`}
            data-density={density}
          >
            <TableCaption className='sr-only'>{copy.tableCaption}</TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className='hover:bg-transparent' key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className={runColumnClassName(header.column.id)}
                      key={header.id}
                      scope='col'
                    >
                      <RunSortableHeader header={header} locale={locale} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <td
                    className='text-muted-foreground px-3 py-6 text-center text-sm'
                    colSpan={visibleColumnCount}
                  >
                    {copy.tableFallback}
                  </td>
                </TableRow>
              ) : null}
              {visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <RunTableCell cell={cell} key={cell.id} locale={locale} />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <RunTablePagination locale={locale} table={table} />
        </CardContent>
      </Card>
    </section>
  );
}
