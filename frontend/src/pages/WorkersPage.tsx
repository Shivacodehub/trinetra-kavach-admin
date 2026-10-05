import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, Eye, History, Plus } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import { useClampPage, useFilters } from "../hooks/useFilters";
import type { ModuleStats, Paged, WorkerRow } from "../types/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Column, DataTable, Pagination } from "../components/DataTable";
import { FilterBar, SearchBox, SelectInput, TextInput } from "../components/Fields";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { TrainingStatusBadge, WorkerCertBadge, DemoBadge } from "../components/StatusBadge";
import { WorkerForm } from "../components/WorkerForm";
import { formatDate, formatScore } from "../utils/format";

const PAGE_SIZE = 15;

export default function WorkersPage() {
  const f = useFilters(), { orgId } = useOrg(), navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const sort = { by: f.get("sort") || "name", order: (f.get("order") || "asc") as "asc" | "desc" };
  const query = { page: f.page, page_size: PAGE_SIZE, organization_id: orgId, search: f.get("search"), module_id: f.get("module"), status: f.get("status"),
    certificate_status: f.get("cert"), date_from: f.get("from"), date_to: f.get("to"), sort_by: sort.by, sort_order: sort.order };
  const workers = useQuery({ queryKey: ["workers", query], queryFn: () => api<Paged<WorkerRow>>("/workers", { query }), placeholderData: (p) => p });
  const modules = useQuery({ queryKey: ["modules", ""], queryFn: () => api<ModuleStats[]>("/modules"), staleTime: 300_000 });
  useClampPage(f.page, workers.data?.pages, f.setPage);

  const cols: Column<WorkerRow>[] = [
    { key: "name", header: "Name", sort: "name", render: (w) => <><Link to={`/workers/${w.id}`} className="font-medium text-steel-700 hover:underline">{w.name}</Link> {w.is_demo && <DemoBadge />}</> },
    { key: "code", header: "Worker ID", sort: "worker_code", render: (w) => <span className="font-mono text-xs">{w.worker_code}</span> },
    { key: "org", header: "Organization", render: (w) => w.organization.name },
    { key: "role", header: "Role", render: (w) => w.role_title ?? "-" },
    { key: "mods", header: "Modules", sort: "modules_completed", render: (w) => <span className="num">{w.modules_completed} / {w.total_modules}</span> },
    { key: "avg", header: "Avg score", sort: "avg_score", align: "right", render: (w) => <span className="num font-medium">{formatScore(w.average_score)}</span> },
    { key: "train", header: "Training", render: (w) => <TrainingStatusBadge status={w.training_status} /> },
    { key: "cert", header: "Certificate", render: (w) => <WorkerCertBadge status={w.certificate_status} /> },
    { key: "last", header: "Last activity", sort: "last_activity", render: (w) => <span className="num text-muted">{formatDate(w.last_activity_at)}</span> },
    { key: "actions", header: "Actions", render: (w) => (
      <div className="flex gap-0.5">
        <IconButton label={`View ${w.name}`} onClick={() => navigate(`/workers/${w.id}`)}><Eye className="h-4 w-4" /></IconButton>
        <IconButton label={`Training history of ${w.name}`} onClick={() => navigate(`/assessments?worker=${w.id}&wname=${encodeURIComponent(w.name)}`)}><History className="h-4 w-4" /></IconButton>
        <IconButton label={`Certificates of ${w.name}`} onClick={() => navigate(`/certificates?search=${w.worker_code}`)}><Award className="h-4 w-4" /></IconButton>
      </div>) },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Worker Management" subtitle="Workers, training progress and certificate status"
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden />Add worker</Button>} />
      <Card bodyClass="">
        <FilterBar>
          <SearchBox value={f.get("search")} onSearch={(v) => f.set({ search: v })} placeholder="Search name or worker ID" label="Search workers" />
          <SelectInput aria-label="Module" value={f.get("module")} onChange={(e) => f.set({ module: e.target.value })} className="!w-auto">
            <option value="">All modules</option>{modules.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</SelectInput>
          <SelectInput aria-label="Training status" value={f.get("status")} onChange={(e) => f.set({ status: e.target.value })} className="!w-auto">
            <option value="">Any training status</option><option value="completed">Completed</option><option value="in_progress">In progress</option><option value="not_started">Not started</option></SelectInput>
          <SelectInput aria-label="Certificate status" value={f.get("cert")} onChange={(e) => f.set({ cert: e.target.value })} className="!w-auto">
            <option value="">Any certificate status</option><option value="certified">Certified</option><option value="partial">Partial</option><option value="none">None</option></SelectInput>
          <label className="flex items-center gap-1 text-xs text-muted">Active from<TextInput type="date" value={f.get("from")} onChange={(e) => f.set({ from: e.target.value })} className="!w-auto" /></label>
          <label className="flex items-center gap-1 text-xs text-muted">to<TextInput type="date" value={f.get("to")} onChange={(e) => f.set({ to: e.target.value })} className="!w-auto" /></label>
        </FilterBar>
        <DataTable what="workers" columns={cols} rows={workers.data?.items} rowKey={(w) => w.id} loading={workers.isPending} error={workers.error} onRetry={() => workers.refetch()}
          sort={sort} onSort={(s) => f.set({ sort: s.by, order: s.order })} emptyMessage="No workers match these filters." />
        {workers.data && <Pagination page={workers.data.page} pages={workers.data.pages} total={workers.data.total} pageSize={PAGE_SIZE} onPage={f.setPage} />}
      </Card>
      <Modal open={adding} title="Add worker" onClose={() => setAdding(false)}>
        <WorkerForm defaultOrgId={orgId} onDone={(w) => { setAdding(false); navigate(`/workers/${w.id}`); }} />
      </Modal>
    </div>
  );
}
