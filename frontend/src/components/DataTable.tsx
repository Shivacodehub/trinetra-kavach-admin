import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { IconButton } from "./IconButton";
import { EmptyState, ErrorState, Skeleton } from "./States";

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; sort?: string; align?: "right"; className?: string }
export interface SortState { by: string; order: "asc" | "desc" }

interface Props<T> {
  columns: Column<T>[]; rows: T[] | undefined; rowKey: (r: T) => string; loading?: boolean; error?: unknown; onRetry?: () => void;
  what: string; emptyMessage?: string; sort?: SortState; onSort?: (s: SortState) => void;
}

/** Table on desktop/tablet; stacked cards on phones (first column is the card title). */
export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, what, emptyMessage, sort, onSort }: Props<T>) {
  if (error) return <ErrorState error={error} what={what} onRetry={onRetry} />;
  if (loading) return <div className="space-y-2 p-4" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
  if (!rows?.length) return <EmptyState message={emptyMessage ?? `No ${what} found.`} />;
  const [first, ...rest] = columns;
  const toggle = (c: Column<T>) => c.sort && onSort?.({ by: c.sort, order: sort?.by === c.sort && sort.order === "asc" ? "desc" : "asc" });

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface/60 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>{columns.map((c) => {
              const active = !!c.sort && sort?.by === c.sort;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort!.order === "asc" ? "ascending" : "descending") : undefined}
                  className={`whitespace-nowrap px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                  {c.sort && onSort ? (
                    <button type="button" onClick={() => toggle(c)} className="inline-flex items-center gap-1 uppercase hover:text-ink-900">
                      {c.header}{active ? (sort!.order === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />) : <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />}
                    </button>) : c.header}
                </th>);
            })}</tr>
          </thead>
          <tbody>{rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-steel-100/40">
              {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 align-middle ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>)}
            </tr>))}</tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">{rows.map((r) => (
        <li key={rowKey(r)} className="p-3">
          <div className="mb-1.5 text-sm font-medium">{first.render(r)}</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">{rest.map((c) => (
            <div key={c.key} className={c.key === "actions" ? "col-span-2 pt-1" : ""}>
              {c.key !== "actions" && <dt className="text-muted">{c.header}</dt>}<dd className="text-sm">{c.render(r)}</dd>
            </div>))}</dl>
        </li>))}</ul>
    </>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1, to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
      <span className="num">Showing {from}-{to} of {total}</span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></IconButton>
        <span className="num px-1">Page {page} of {pages}</span>
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="disabled:opacity-30"><ChevronRight className="h-4 w-4" /></IconButton>
      </div>
    </div>
  );
}
