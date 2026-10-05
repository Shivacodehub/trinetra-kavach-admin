import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import { useClampPage, useFilters } from "../hooks/useFilters";
import type { AttemptRow, ModuleStats, Paged } from "../types/api";
import { Card } from "../components/Card";
import { Column, DataTable, Pagination } from "../components/DataTable";
import { FilterBar, SearchBox, SelectInput, TextInput } from "../components/Fields";
import { IconButton } from "../components/IconButton";
import { PageHeader } from "../components/PageHeader";
import { DemoBadge, ResultBadge } from "../components/StatusBadge";
import { formatDateTime, formatDuration, formatScore, shortId } from "../utils/format";

const PAGE_SIZE = 15;

export default function AssessmentsPage() {
  const f = useFilters(), { orgId } = useOrg();
  const sort = { by: f.get("sort") || "started_at", order: (f.get("order") || "desc") as "asc" | "desc" };
  const query = { page: f.page, page_size: PAGE_SIZE, organization_id: orgId, worker_id: f.get("worker"), search: f.get("search"), module_id: f.get("module"),
    result: f.get("result"), date_from: f.get("from"), date_to: f.get("to"), sort_by: sort.by, sort_order: sort.order };
  const list = useQuery({ queryKey: ["assessments", query], queryFn: () => api<Paged<AttemptRow>>("/assessments", { query }), placeholderData: (p) => p });
  const modules = useQuery({ queryKey: ["modules", ""], queryFn: () => api<ModuleStats[]>("/modules"), staleTime: 300_000 });
  useClampPage(f.page, list.data?.pages, f.setPage);

  const cols: Column<AttemptRow>[] = [
    { key: "attempt", header: "Attempt ID", render: (a) => <span className="font-mono text-xs" title={a.attempt_id}>{shortId(a.attempt_id)}</span> },
    { key: "worker", header: "Worker", render: (a) => <><Link to={`/workers/${a.worker.id}`} className="font-medium text-steel-700 hover:underline">{a.worker.name}</Link> {a.is_demo && <DemoBadge />}<div className="text-xs text-muted">{a.worker.worker_code}</div></> },
    { key: "module", header: "Module", render: (a) => a.module.name },
    { key: "scenario", header: "Scenario", render: (a) => a.scenario.name },
    { key: "score", header: "Score", sort: "score", align: "right", render: (a) => <span className="num font-medium">{formatScore(a.score)}</span> },
    { key: "dur", header: "Duration", sort: "duration", render: (a) => <span className="num">{formatDuration(a.duration_seconds)}</span> },
    { key: "res", header: "Result", render: (a) => <ResultBadge result={a.result} /> },
    { key: "date", header: "Date", sort: "started_at", render: (a) => <span className="num text-muted">{formatDateTime(a.started_at)}</span> },
    { key: "actions", header: "Actions", render: (a) => <Link to={`/assessments/${a.id}`} title="View assessment timeline" aria-label="View assessment timeline" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-ink-900"><Eye className="h-4 w-4" /></Link> },
  ];


  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Assessment Results" subtitle="Scored attempts synced from the Android training app" />
      <Card bodyClass="">
        <FilterBar>
          <SearchBox value={f.get("search")} onSearch={(v) => f.set({ search: v })} placeholder="Search worker, ID or attempt" label="Search assessments" />
          <SelectInput aria-label="Module" value={f.get("module")} onChange={(e) => f.set({ module: e.target.value })} className="!w-auto"><option value="">All modules</option>{modules.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</SelectInput>
          <SelectInput aria-label="Result" value={f.get("result")} onChange={(e) => f.set({ result: e.target.value })} className="!w-auto"><option value="">Pass and fail</option><option value="pass">Pass only</option><option value="fail">Fail only</option></SelectInput>
          <label className="flex items-center gap-1 text-xs text-muted">From<TextInput type="date" value={f.get("from")} onChange={(e) => f.set({ from: e.target.value })} className="!w-auto" /></label>
          <label className="flex items-center gap-1 text-xs text-muted">to<TextInput type="date" value={f.get("to")} onChange={(e) => f.set({ to: e.target.value })} className="!w-auto" /></label>
          {f.get("worker") && <span className="inline-flex items-center gap-1 rounded-sm border border-steel-600/40 bg-steel-100 px-2 py-1 text-xs font-medium text-steel-700">
            Worker: {f.get("wname") || "selected"}<IconButton label="Clear worker filter" className="!h-5 !w-5" onClick={() => f.set({ worker: "", wname: "" })}><X className="h-3 w-3" /></IconButton></span>}
        </FilterBar>
        <DataTable what="assessments" columns={cols} rows={list.data?.items} rowKey={(a) => a.id} loading={list.isPending} error={list.error} onRetry={() => list.refetch()}
          sort={sort} onSort={(s) => f.set({ sort: s.by, order: s.order })} emptyMessage="No assessments match these filters." />
        {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={f.setPage} />}
      </Card>
    </div>
  );
}
