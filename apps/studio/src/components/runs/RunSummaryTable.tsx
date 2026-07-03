"use client";

import type { RunQueueDensity } from "@/lib/runQueueWorkbench";
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
import { useMemo, useState } from "react";
import { runColumnClassName, runSummaryColumns } from "./RunSummaryTableColumns";
import {
  ColumnVisibilityMenu,
  RunSortableHeader,
  RunTableCell,
  RunTablePagination,
} from "./RunSummaryTableControls";

type RunSummaryTableProps = Readonly<{
  density?: RunQueueDensity;
  emptyState?: Readonly<{
    heading: string;
    message: string;
  }>;
  runs: readonly StudioRunSummary[];
}>;

const initialColumnVisibility = {
  channelHandoff: false,
  finalBundle: false,
} as const satisfies VisibilityState;

const initialPagination = {
  pageIndex: 0,
  pageSize: 10,
} as const satisfies PaginationState;

/**
 * Displays a TanStack-powered summary grid of saved producer runs.
 *
 * @param density - The operator-selected table density.
 * @param runs - The runs to display
 */
export function RunSummaryTable({
  density = "comfortable",
  emptyState = {
    heading: "No runs yet",
    message: "Start with the CLI source of truth: pnpm producer ideas.",
  },
  runs,
}: RunSummaryTableProps) {
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnVisibility);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => [...runs], [runs]);
  const columns = useMemo(() => runSummaryColumns(), []);
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
    state: {
      columnVisibility,
      pagination,
      sorting,
    },
  });
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const visibleRows = table.getRowModel().rows;

  if (runs.length === 0) {
    return (
      <section className='panel' aria-labelledby='runs-empty-heading'>
        <h2 id='runs-empty-heading'>{emptyState.heading}</h2>
        <p>{emptyState.message}</p>
      </section>
    );
  }

  return (
    <section className='panel' aria-labelledby='runs-index-heading'>
      <div className='run-table-heading'>
        <div>
          <h2 id='runs-index-heading'>Run Index</h2>
          <p>
            Data-grid projection over local CLI/core run summaries. Header sorting and column
            toggles are read-only.
          </p>
        </div>
        <div className='run-table-toolbar'>
          <span className='status-pill small'>
            {visibleRows.length} of {totalRows} rows
          </span>
          <ColumnVisibilityMenu table={table} />
        </div>
      </div>
      <div className='run-table-scroll'>
        <table className='run-table' data-density={density}>
          <caption className='sr-only'>Saved producer runs and their next safe actions</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr className='run-row run-row-head' key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className={runColumnClassName(header.column.id)} key={header.id} scope='col'>
                    <RunSortableHeader header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr className='run-row' key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <RunTableCell key={cell.id} cell={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RunTablePagination table={table} />
    </section>
  );
}
