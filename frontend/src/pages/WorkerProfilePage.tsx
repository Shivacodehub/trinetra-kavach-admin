import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, UserX } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useFilters, useClampPage } from "../hooks/useFilters";
import type { AttemptRow, CertificateRow, Paged, WorkerProfile } from "../types/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Column, DataTable, Pagination } from "../components/DataTable";
import { Field, TextInput } from "../components/Fields";
import { KpiCard } from "../components/KpiCard";
import { MetricBars } from "../components/MetricBars";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, Skeleton } from "../components/States";
import { CertBadge, DemoBadge, ResultBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { WorkerForm } from "../components/WorkerForm";
import { BadgeCheck, GraduationCap, ListChecks, Percent, Target } from "lucide-react";
import { LANGUAGES, formatDate, formatDateTime, formatDuration, formatScore } from "../utils/format";

function PinModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [pin, setPin] = useState(""), [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api(`/workers/${id}/reset-pin`, { method: "POST", body: { pin } }),
    onSuccess: () => { toast("success", "Android app PIN updated."); setPin(""); onClose(); },
    onError: (e) => setErr(e instanceof ApiError ? (e.details?.[0]?.message ?? e.message) : "Unable to update the PIN."),
  });
  return (
    <Modal open={open} title="Set Android app PIN" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setErr(null); if (!/^[0-9]{4,8}$/.test(pin)) return setErr("PIN must be 4-8 digits"); m.mutate(); }}>
        <Field label="New PIN" error={err ?? undefined} hint="The worker uses their Worker ID and this PIN to sign in on the Android app."><TextInput inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} autoFocus /></Field>
        <div className="flex justify-end"><Button type="submit" loading={m.isPending}>Save PIN</Button></div>
      </form>
    </Modal>
  );
}

export default function WorkerProfilePage() {
  const { id = "" } = useParams(), navigate = useNavigate(), qc = useQueryClient(), toast = useToast(), f = useFilters();
  const [edit, setEdit] = useState(false), [pin, setPin] = useState(false), [deact, setDeact] = useState(false);
  const w = useQuery({ queryKey: ["worker", id], queryFn: () => api<WorkerProfile>(`/workers/${id}`), retry: false });
  const q = { worker_id: id, page: f.page, page_size: 8 };
  const history = useQuery({ queryKey: ["attempts", q], queryFn: () => api<Paged<AttemptRow>>("/training/attempts", { query: q }), enabled: !!w.data, placeholderData: (p) => p });
  const certs = useQuery({ queryKey: ["certificates", "worker", w.data?.worker_code], queryFn: () => api<Paged<CertificateRow>>("/certificates", { query: { search: w.data!.worker_code, page_size: 20 } }), enabled: !!w.data });
  useClampPage(f.page, history.data?.pages, f.setPage);
  const deactivate = useMutation({
    mutationFn: () => api(`/workers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast("success", "Worker deactivated. Training records are kept."); navigate("/workers"); },
    onError: (e) => toast("error", e instanceof ApiError ? e.message : "Unable to deactivate the worker."),
  });

  if (w.isPending) return <div className="mx-auto max-w-[1200px] space-y-3"><Skeleton className="h-10 w-72" /><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (w.isError) return <Card className="mx-auto max-w-xl"><ErrorState error={w.error} what="this worker" onRetry={() => w.refetch()} />
    <div className="pb-4 text-center"><Link to="/workers" className="text-sm font-medium text-steel-700 hover:underline">Back to workers</Link></div></Card>;
  const p = w.data, s = p.summary;

  const cols: Column<AttemptRow>[] = [
    { key: "date", header: "Date", render: (a) => <span className="num">{formatDateTime(a.started_at)}</span> },
    { key: "module", header: "Module", render: (a) => a.module.name },
    { key: "scenario", header: "Scenario", render: (a) => a.scenario.name },
    { key: "score", header: "Score", align: "right", render: (a) => <span className="num font-medium">{formatScore(a.score)}</span> },
    { key: "dur", header: "Duration", render: (a) => <span className="num">{formatDuration(a.duration_seconds)}</span> },
    { key: "res", header: "Result", render: (a) => <ResultBadge result={a.result} /> },
    { key: "actions", header: "Details", render: (a) => a.result ? <Link className="text-sm font-medium text-steel-700 hover:underline" to={`/assessments/${a.id}`}>View timeline</Link> : <span className="text-xs text-muted">Awaiting result</span> },
  ];
  const info: [string, string][] = [["Worker ID", p.worker_code], ["Organization", p.organization.name], ["Department", p.department ?? "-"], ["Role", p.role_title ?? "-"],
    ["Language", LANGUAGES[p.preferred_language]], ["Email", p.email ?? "-"], ["Phone", p.phone ?? "-"], ["Joined", formatDate(p.joined_at)], ["Last activity", formatDate(p.last_activity_at)]];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader back={{ to: "/workers", label: "Worker Management" }} title={p.name}
        subtitle={<span className="flex items-center gap-2">{p.worker_code} {p.is_demo && <DemoBadge />} {!p.is_active && <span className="font-semibold text-bad-700">DEACTIVATED</span>}</span>}
        actions={<>
          <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" aria-hidden />Edit</Button>
          <Button variant="secondary" onClick={() => setPin(true)}><KeyRound className="h-4 w-4" aria-hidden />App PIN</Button>
          {p.is_active && <Button variant="secondary" onClick={() => setDeact(true)}><UserX className="h-4 w-4" aria-hidden />Deactivate</Button>}
        </>} />
      <Card title="Worker profile" className="mb-4"><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
        {info.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}</dl></Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Modules completed" value={`${s.modules_completed} / ${s.total_modules}`} icon={GraduationCap} />
        <KpiCard label="Average score" value={formatScore(s.average_score)} icon={Target} />
        <KpiCard label="Pass rate" value={s.pass_rate === null ? "-" : `${s.pass_rate}%`} icon={Percent} />
        <KpiCard label="Attempts" value={s.attempts} icon={ListChecks} hint={`${s.completed_attempts} scored`} />
        <KpiCard label="Certificates" value={s.certificates} icon={BadgeCheck} hint="Currently valid" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Training history" className="lg:col-span-2" bodyClass="">
          <DataTable what="training history" columns={cols} rows={history.data?.items} rowKey={(a) => a.id} loading={history.isPending} error={history.error} onRetry={() => history.refetch()} emptyMessage="This worker has no training attempts yet." />
          {history.data && <Pagination page={history.data.page} pages={history.data.pages} total={history.data.total} pageSize={8} onPage={f.setPage} />}
        </Card>
        <Card title="Behavioural performance"><MetricBars metrics={p.behavior_performance} /></Card>
      </div>

      <Card title="Certificates" className="mt-4" bodyClass="">
        {certs.isError ? <ErrorState error={certs.error} what="certificates" onRetry={() => certs.refetch()} /> :
          !certs.data?.items.length ? <p className="p-4 text-sm text-muted">{certs.isPending ? "Loading..." : "No certificates issued to this worker yet."}</p> :
          <ul className="divide-y divide-line">{certs.data.items.map((c) => (
            <li key={c.certificate_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <Link to={`/certificates/${c.certificate_id}`} className="font-mono text-xs text-steel-700 hover:underline">{c.certificate_id}</Link>
              <span>{c.module.name}</span><span className="num text-muted">{formatDate(c.issued_at)}</span><CertBadge status={c.status} />
            </li>))}</ul>}
      </Card>

      <Modal open={edit} title="Edit worker" onClose={() => setEdit(false)}><WorkerForm worker={p} onDone={() => setEdit(false)} /></Modal>
      <PinModal id={p.id} open={pin} onClose={() => setPin(false)} />
      <ConfirmDialog open={deact} danger title="Deactivate this worker?" confirmLabel="Deactivate" onCancel={() => setDeact(false)}
        message="They will no longer be able to sign in to the Android app or appear in worker lists. Training and certificate records are kept." onConfirm={() => { setDeact(false); deactivate.mutate(); }} />
    </div>
  );
}
