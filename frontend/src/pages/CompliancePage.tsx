import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import { useClampPage, useFilters } from "../hooks/useFilters";
import type { ComplianceRow, ComplianceStatus, ModuleStats } from "../types/api";
import { Card } from "../components/Card";
import { Column, DataTable, Pagination } from "../components/DataTable";
import { FilterBar, SearchBox, SelectInput } from "../components/Fields";
import { PageHeader } from "../components/PageHeader";
import { CertBadge, ComplianceBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/States";
import { formatDate, formatScore } from "../utils/format";
import type { ComplianceResponse } from "../types/api";

const PAGE_SIZE = 15;
const TILES: { key: ComplianceStatus; label: string; cls: string }[] = [
  { key: "COMPLIANT", label: "Compliant", cls: "border-ok-600" }, { key: "TRAINING_DUE", label: "Training due", cls: "border-warn-600" },
  { key: "FAILED", label: "Failed", cls: "border-bad-600" }, { key: "NOT_STARTED", label: "Not started", cls: "border-idle-600" },
];

export default function CompliancePage() {
  const f = useFilters(), { orgId } = useOrg();
  const query = { page: f.page, page_size: PAGE_SIZE, organization_id: orgId, search: f.get("search"), module_id: f.get("module"), status: f.get("status") };
  const q = useQuery({ queryKey: ["compliance", query], queryFn: () => api<ComplianceResponse>("/compliance", { query }), placeholderData: (p) => p });
  const modules = useQuery({ queryKey: ["modules", ""], queryFn: () => api<ModuleStats[]>("/modules"), staleTime: 300_000 });
  useClampPage(f.page, q.data?.pages, f.setPage);

  const cols: Column<ComplianceRow>[] = [
    { key: "worker", header: "Worker", render: (r) => <><Link to={`/workers/${r.worker.id}`} className="font-medium text-steel-700 hover:underline">{r.worker.name}</Link><div className="text-xs text-muted">{r.worker.worker_code} &middot; {r.worker.organization}</div></> },
    { key: "module", header: "Required module", render: (r) => r.module.name },
    { key: "done", header: "Completion", render: (r) => r.completed ? "✓ Passed" : r.status === "FAILED" ? "✕ Not passed" : "Not completed" },
    { key: "score", header: "Best score", align: "right", render: (r) => <span className="num font-medium">{formatScore(r.best_score)}</span> },
    { key: "status", header: "Status", render: (r) => <ComplianceBadge status={r.status} /> },
    { key: "cert", header: "Certificate", render: (r) => r.certificate_id ? <><Link to={`/certificates/${r.certificate_id}`} className="font-mono text-[11px] text-steel-700 hover:underline">{r.certificate_id}</Link>{r.certificate_status && <div className="mt-0.5"><CertBadge status={r.certificate_status} /></div>}</> : <span className="text-muted">-</span> },
    { key: "last", header: "Last training", render: (r) => <span className="num text-muted">{formatDate(r.last_training_at)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Compliance Monitoring" subtitle="Which workers have completed the required training modules?" />
      <div className="mb-4 flex gap-2 rounded-md border border-steel-600/30 bg-steel-100 p-3 text-xs text-steel-700"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Prototype monitoring view. Every active module is treated as required for every worker. This is not a statement of legal or regulatory compliance. {q.data?.note ? "" : ""}</p></div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{TILES.map((t) => (
        <button key={t.key} type="button" onClick={() => f.set({ status: f.get("status") === t.key ? "" : t.key })} aria-pressed={f.get("status") === t.key}
          className={`rounded-md border border-l-4 bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,30,51,.05)] hover:bg-surface ${t.cls} ${f.get("status") === t.key ? "ring-2 ring-steel-500" : "border-line"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t.label}</div>
          {q.data ? <div className="num mt-1 text-3xl font-semibold">{q.data.summary[t.key]}</div> : <Skeleton className="mt-2 h-8 w-12" />}
          <div className="text-xs text-muted">worker-module pairs</div></button>))}</div>
      <Card bodyClass="">
        <FilterBar>
          <SearchBox value={f.get("search")} onSearch={(v) => f.set({ search: v })} placeholder="Search worker" label="Search workers" />
          <SelectInput aria-label="Module" value={f.get("module")} onChange={(e) => f.set({ module: e.target.value })} className="!w-auto"><option value="">All required modules</option>{modules.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</SelectInput>
          <SelectInput aria-label="Status" value={f.get("status")} onChange={(e) => f.set({ status: e.target.value })} className="!w-auto"><option value="">Any status</option>{TILES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</SelectInput>
        </FilterBar>
        <DataTable what="compliance records" columns={cols} rows={q.data?.items} rowKey={(r) => r.worker.id + r.module.id} loading={q.isPending} error={q.error} onRetry={() => q.refetch()} emptyMessage="No records match these filters." />
        {q.data && <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} pageSize={PAGE_SIZE} onPage={f.setPage} />}
      </Card>
    </div>
  );
}
