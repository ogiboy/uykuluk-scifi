import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function ColumnVisibilityMenu({ table }: ColumnVisibilityMenuProps) {
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type='button' variant='secondary'>
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='run-column-menu'>
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
      className='run-sort-button'
      type='button'
      aria-label={`Sort by ${label}`}
      onClick={header.column.getToggleSortingHandler()}
    >
      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
      <span className='run-sort-indicator' aria-hidden='true'>
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
    <td className={className} data-label={label}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
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
