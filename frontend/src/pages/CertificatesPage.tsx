import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Download, Eye, ShieldCheck, ShieldX, Timer } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import { useClampPage, useFilters } from "../hooks/useFilters";
import type { CertificateRow, CertificateStats, ModuleStats, Paged } from "../types/api";
import { Card } from "../components/Card";
import { Column, DataTable, Pagination } from "../components/DataTable";
import { FilterBar, SearchBox, SelectInput } from "../components/Fields";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { CertBadge, DemoBadge } from "../components/StatusBadge";
import { formatDate, formatScore } from "../utils/format";

const PAGE_SIZE = 15;
const iconLink = "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-ink-900";

export default function CertificatesPage() {
  const f = useFilters(), { orgId } = useOrg();
  const query = { page: f.page, page_size: PAGE_SIZE, organization_id: orgId, search: f.get("search"), status: f.get("status"), module_id: f.get("module"), sort_order: f.get("order") || "desc" };
  const list = useQuery({ queryKey: ["certificates", query], queryFn: () => api<Paged<CertificateRow>>("/certificates", { query }), placeholderData: (p) => p });
  const stats = useQuery({ queryKey: ["certstats", orgId], queryFn: () => api<CertificateStats>("/certificates/stats", { query: { organization_id: orgId } }) });
  const modules = useQuery({ queryKey: ["modules", ""], queryFn: () => api<ModuleStats[]>("/modules"), staleTime: 300_000 });
  useClampPage(f.page, list.data?.pages, f.setPage);
  const s = stats.data, loading = stats.isPending;

  const cols: Column<CertificateRow>[] = [
    { key: "id", header: "Certificate ID", render: (c) => <><Link to={`/certificates/${c.certificate_id}`} className="font-mono text-xs font-medium text-steel-700 hover:underline">{c.certificate_id}</Link> {c.is_demo && <DemoBadge />}</> },
    { key: "worker", header: "Worker", render: (c) => <><Link to={`/workers/${c.worker.id}`} className="hover:underline">{c.worker.name}</Link><div className="text-xs text-muted">{c.worker.worker_code}</div></> },
    { key: "module", header: "Module", render: (c) => c.module.name },
    { key: "score", header: "Score", align: "right", render: (c) => <span className="num font-medium">{formatScore(c.score)}</span> },
    { key: "date", header: "Issue date", render: (c) => <span className="num text-muted">{formatDate(c.issued_at)}</span> },
    { key: "status", header: "Status", render: (c) => <CertBadge status={c.status} /> },
    { key: "ver", header: "Verification", render: (c) => c.verification_count > 0 ? <span className="inline-flex items-center gap-1 text-xs font-medium text-ok-700"><CheckCircle2 className="h-3 w-3" aria-hidden />Verified {c.verification_count}x</span> : <span className="text-xs text-muted">Not yet verified</span> },
    { key: "actions", header: "Actions", render: (c) => (
      <div className="flex gap-0.5">
        <Link to={`/certificates/${c.certificate_id}`} title="View certificate" aria-label="View certificate" className={iconLink}><Eye className="h-4 w-4" /></Link>
        <Link to={`/certificates/${c.certificate_id}?print=1`} title="Download (print or save as PDF)" aria-label="Download certificate as PDF" className={iconLink}><Download className="h-4 w-4" /></Link>
        <a href={`/verify/${c.certificate_id}`} target="_blank" rel="noreferrer" title="Open public verification page" aria-label="Verify certificate (opens public page)" className={iconLink}><ShieldCheck className="h-4 w-4" /></a>
      </div>) },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Certificate Management" subtitle="Digital training certificates issued from passed assessments (prototype)" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Issued" value={s?.issued} icon={Award} loading={loading} />
        <KpiCard label="Active" value={s?.active} icon={ShieldCheck} loading={loading} />
        <KpiCard label="Revoked" value={s?.revoked} icon={ShieldX} loading={loading} tone={s && s.revoked > 0 ? "bad" : "default"} />
        <KpiCard label="Expiring in 30 days" value={s?.expiring_30d} icon={Timer} loading={loading} hint={s && s.expired > 0 ? `${s.expired} expired` : "Only if an expiry period is configured"} />
      </div>
      <Card bodyClass="">
        <FilterBar>
          <SearchBox value={f.get("search")} onSearch={(v) => f.set({ search: v })} placeholder="Certificate ID or worker" label="Search certificates" />
          <SelectInput aria-label="Status" value={f.get("status")} onChange={(e) => f.set({ status: e.target.value })} className="!w-auto"><option value="">Any status</option><option value="valid">Valid</option><option value="revoked">Revoked</option><option value="expired">Expired</option></SelectInput>
          <SelectInput aria-label="Module" value={f.get("module")} onChange={(e) => f.set({ module: e.target.value })} className="!w-auto"><option value="">All modules</option>{modules.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</SelectInput>
        </FilterBar>
        <DataTable what="certificates" columns={cols} rows={list.data?.items} rowKey={(c) => c.certificate_id} loading={list.isPending} error={list.error} onRetry={() => list.refetch()} emptyMessage="No certificates match these filters." />
        {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={f.setPage} />}
      </Card>
    </div>
  );
}
