import { Button } from "@/components/ui/button";
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
import { TableCell } from "@/components/ui/table";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { flexRender, type Cell, type Header, type Table } from "@tanstack/react-table";
import { runColumnClassName, runColumnLabel } from "./RunSummaryTableColumns";
import { runQueueCopy } from "./runQueueCopy";

type RunTableCellModel = Cell<StudioRunSummary, unknown>;
type RunTableHeader = Header<StudioRunSummary, unknown>;

type ColumnVisibilityMenuProps = Readonly<{ locale: StudioLocale; table: Table<StudioRunSummary> }>;

type RunSortableHeaderProps = Readonly<{ header: RunTableHeader; locale: StudioLocale }>;

type RunTableCellProps = Readonly<{ cell: RunTableCellModel; locale: StudioLocale }>;

const pageSizeOptions = [10, 25, 50] as const;

export function ColumnVisibilityMenu({ locale, table }: ColumnVisibilityMenuProps) {
  const copy = runQueueCopy(locale);
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type='button' variant='secondary'>
          {copy.columns}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>{copy.visibleColumns}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            checked={column.getIsVisible()}
            key={column.id}
            onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
          >
            {runColumnLabel(column.columnDef.meta, locale)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RunTablePagination({ locale, table }: ColumnVisibilityMenuProps) {
  const copy = runQueueCopy(locale);
  const pagination = table.getState().pagination;
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const currentRows = table.getRowModel().rows.length;
  const firstRow = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = currentRows === 0 ? 0 : firstRow + currentRows - 1;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div
      className='text-muted-foreground flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between'
      aria-label={`${copy.indexTitle} ${copy.pagination(firstRow, lastRow, totalRows)}`}
    >
      <p aria-live='polite'>
        {copy.pagination(firstRow, lastRow, totalRows)}{" "}
        {copy.page(pagination.pageIndex + 1, pageCount)}
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.firstPage()}
          type='button'
          variant='secondary'
        >
          {copy.first}
        </Button>
        <Button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          type='button'
          variant='secondary'
        >
          {copy.previous}
        </Button>
        <Button
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          type='button'
          variant='secondary'
        >
          {copy.next}
        </Button>
        <Button
          disabled={!table.getCanNextPage()}
          onClick={() => table.lastPage()}
          type='button'
          variant='secondary'
        >
          {copy.last}
        </Button>
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(value) => setPageSize(table, value)}
        >
          <SelectTrigger className='w-32' aria-label={copy.rowsPerPage}>
            <SelectValue placeholder={copy.rowsPerPage} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize} {copy.rowUnit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RunSortableHeader({ header, locale }: RunSortableHeaderProps) {
  if (header.isPlaceholder) {
    return null;
  }
  const sorted = header.column.getIsSorted();
  const label = runColumnLabel(header.column.columnDef.meta, locale);
  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }
  return (
    <button
      className='hover:bg-muted focus-visible:ring-ring inline-flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'
      type='button'
      aria-label={runQueueCopy(locale).sortBy(label)}
      onClick={header.column.getToggleSortingHandler()}
    >
      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
      <span className='text-muted-foreground' aria-hidden='true'>
        {sortIndicator(sorted)}
      </span>
    </button>
  );
}

export function RunTableCell({ cell, locale }: RunTableCellProps) {
  const label = runColumnLabel(cell.column.columnDef.meta, locale);
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
