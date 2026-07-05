import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { flexRender, type Cell, type Header, type Table } from "@tanstack/react-table";
import { runColumnClassName, runColumnLabel } from "./RunSummaryTableColumns";

type RunTableCellModel = Cell<StudioRunSummary, unknown>;
type RunTableHeader = Header<StudioRunSummary, unknown>;

type ColumnVisibilityMenuProps = Readonly<{
  table: Table<StudioRunSummary>;
}>;

type RunSortableHeaderProps = Readonly<{
  header: RunTableHeader;
}>;

type RunTableCellProps = Readonly<{
  cell: RunTableCellModel;
}>;

const pageSizeOptions = [10, 25, 50] as const;

export function ColumnVisibilityMenu({ table }: ColumnVisibilityMenuProps) {
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type='button' variant='secondary'>
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            checked={column.getIsVisible()}
            key={column.id}
            onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
          >
            {runColumnLabel(column.columnDef.meta)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RunTablePagination({ table }: ColumnVisibilityMenuProps) {
  const pagination = table.getState().pagination;
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const currentRows = table.getRowModel().rows.length;
  const firstRow = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = currentRows === 0 ? 0 : firstRow + currentRows - 1;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div
      className='flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between'
      aria-label='Run table pagination'
    >
      <p aria-live='polite'>
        Rows {firstRow}-{lastRow} of {totalRows}. Page {pagination.pageIndex + 1} of {pageCount}.
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.firstPage()}
          type='button'
          variant='secondary'
        >
          First
        </Button>
        <Button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          type='button'
          variant='secondary'
        >
          Previous
        </Button>
        <Button
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          type='button'
          variant='secondary'
        >
          Next
        </Button>
        <Button
          disabled={!table.getCanNextPage()}
          onClick={() => table.lastPage()}
          type='button'
          variant='secondary'
        >
          Last
        </Button>
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(value) => setPageSize(table, value)}
        >
          <SelectTrigger className='w-32' aria-label='Rows per page'>
            <SelectValue placeholder='Rows per page' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize} rows
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RunSortableHeader({ header }: RunSortableHeaderProps) {
  if (header.isPlaceholder) {
    return null;
  }
  const sorted = header.column.getIsSorted();
  const label = runColumnLabel(header.column.columnDef.meta);
  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }
  return (
    <button
      className='inline-flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      type='button'
      aria-label={`Sort by ${label}`}
      onClick={header.column.getToggleSortingHandler()}
    >
      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
      <span className='text-muted-foreground' aria-hidden='true'>
        {sortIndicator(sorted)}
      </span>
    </button>
  );
}

export function RunTableCell({ cell }: RunTableCellProps) {
  const label = runColumnLabel(cell.column.columnDef.meta);
  const className = runColumnClassName(cell.column.id);
  if (cell.column.id === "runId") {
    return (
      <th className={className} data-label={label} scope='row'>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </th>
    );
  }
  return (
    <TableCell className={className} data-label={label}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}

function sortIndicator(sorted: false | "asc" | "desc"): string {
  if (sorted === "asc") {
    return "↑";
  }
  if (sorted === "desc") {
    return "↓";
  }
  return "↕";
}

function setPageSize(table: Table<StudioRunSummary>, value: string): void {
  const pageSize = Number(value);
  if (pageSizeOptions.includes(pageSize as (typeof pageSizeOptions)[number])) {
    table.setPageSize(pageSize);
  }
}
