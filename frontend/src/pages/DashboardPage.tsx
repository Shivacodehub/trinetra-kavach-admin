import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, Award, CheckCircle2, CloudOff, GraduationCap, Layers, Percent, Users, XCircle } from "lucide-react";
import { useModulePerformance, useRecentActivity, useRecentCertificates, useSummary, useTrends } from "../hooks/useDashboard";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { CertBadge, OnlineBadge, ResultBadge } from "../components/StatusBadge";
import { FlowStrip } from "../components/FlowStrip";
import { CompletionTrendChart } from "../charts/CompletionTrendChart";
import { ModulePerformanceChart } from "../charts/ModulePerformanceChart";
import { PassFailChart } from "../charts/PassFailChart";
import { formatDate, formatDateTime, formatScore, relativeTime } from "../utils/format";
import type { AttemptRow, CertificateRow } from "../types/api";

function Async<T>({ q, what, children, h = "h-64" }: {
  q: { data?: T; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; what: string; h?: string; children: (d: T) => ReactNode }) {
  if (q.isPending) return <Skeleton className={`${h} w-full`} />;
  if (q.isError) return <ErrorState error={q.error} what={what} onRetry={() => q.refetch()} />;
  return <>{children(q.data as T)}</>;
}

function ActivityList({ rows }: { rows: AttemptRow[] }) {
  if (!rows.length) return <EmptyState message="No training activity yet." />;
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted"><tr>
          <th className="py-1.5 pr-3 font-semibold">Worker</th><th className="pr-3 font-semibold">Module</th><th className="pr-3 font-semibold">When</th>
          <th className="pr-3 text-right font-semibold">Score</th><th className="font-semibold">Result</th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id} className="border-t border-line">
            <td className="py-2 pr-3"><Link className="font-medium text-steel-700 hover:underline" to={`/workers/${a.worker.id}`}>{a.worker.name}</Link>
              <div className="text-xs text-muted">{a.worker.worker_code}</div></td>
            <td className="pr-3">{a.module.name}<div className="text-xs text-muted">{a.scenario.name}</div></td>
            <td className="num pr-3 text-muted">{formatDateTime(a.started_at)}</td>
            <td className="num pr-3 text-right font-medium">{formatScore(a.score)}</td>
            <td><ResultBadge result={a.result} /></td>
          </tr>))}</tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">{rows.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0"><div className="truncate text-sm font-medium">{a.worker.name} <span className="text-xs font-normal text-muted">{a.worker.worker_code}</span></div>
            <div className="truncate text-xs text-muted">{a.module.name} &middot; {formatDate(a.started_at)}</div></div>
          <div className="flex shrink-0 items-center gap-2"><span className="num text-sm font-medium">{formatScore(a.score)}</span><ResultBadge result={a.result} /></div>
        </li>))}</ul>
    </>
  );
}

function CertList({ rows }: { rows: CertificateRow[] }) {
  if (!rows.length) return <EmptyState message="No certificates issued yet." />;
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted"><tr>
          <th className="py-1.5 pr-3 font-semibold">Certificate ID</th><th className="pr-3 font-semibold">Worker</th><th className="pr-3 font-semibold">Module</th>
          <th className="pr-3 font-semibold">Date</th><th className="font-semibold">Status</th></tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.certificate_id} className="border-t border-line">
            <td className="py-2 pr-3 font-mono text-xs"><Link className="text-steel-700 hover:underline" to={`/certificates/${c.certificate_id}`}>{c.certificate_id}</Link></td>
            <td className="pr-3">{c.worker.name}</td><td className="pr-3">{c.module.name}</td>
            <td className="num pr-3 text-muted">{formatDate(c.issued_at)}</td><td><CertBadge status={c.status} /></td>
          </tr>))}</tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">{rows.map((c) => (
        <li key={c.certificate_id} className="py-2.5">
          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{c.worker.name}</span><CertBadge status={c.status} /></div>
          <div className="truncate text-xs text-muted">{c.module.name} &middot; {formatDate(c.issued_at)}</div>
          <Link className="font-mono text-[11px] text-steel-700" to={`/certificates/${c.certificate_id}`}>{c.certificate_id}</Link>
        </li>))}</ul>
    </>
  );
}

export default function DashboardPage() {
  const summary = useSummary(), trends = useTrends(), modules = useModulePerformance(), activity = useRecentActivity(), certs = useRecentCertificates();
  const s = summary.data, loading = summary.isPending;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {summary.isError && <Card><ErrorState error={summary.error} what="dashboard summary" onRetry={() => summary.refetch()} /></Card>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total workers" value={s?.total_workers} icon={Users} loading={loading} hint="Active worker records" />
        <KpiCard label="Training completed" value={s?.training_completed} icon={GraduationCap} loading={loading} hint="Completed assessments" />
        <KpiCard label="Pass rate" value={s ? `${s.pass_rate}%` : undefined} icon={Percent} loading={loading} hint="Passed / scored attempts" />
        <KpiCard label="Certificates issued" value={s?.certificates_issued} icon={Award} loading={loading}
          hint={s ? `${s.certificates_active} active, ${s.certificates_revoked} revoked` : undefined} />
        <KpiCard label="Active training" value={s?.active_training} icon={Activity} loading={loading} hint="Attempts in progress" />
        <KpiCard label="Failed assessments" value={s?.failed_assessments} icon={XCircle} loading={loading} tone={s && s.failed_assessments > 0 ? "bad" : "default"} hint="Below module pass mark" />
        <KpiCard label="Modules completed" value={s?.modules_completed} icon={Layers} loading={loading} hint="Worker-module passes" />
        <KpiCard label="Pending sync" value={s?.pending_sync} icon={CloudOff} loading={loading} tone={s && s.pending_sync > 0 ? "warn" : "default"} hint="Server records with no sync time" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Training completion - last 30 days" className="xl:col-span-2"><Async q={trends} what="the completion trend">{(d) => <CompletionTrendChart data={d} />}</Async></Card>
        <Card title="Pass vs fail"><Async q={summary} what="pass/fail totals">{(d) => <PassFailChart passed={d.training_completed - d.failed_assessments} failed={d.failed_assessments} />}</Async></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Module performance" className="xl:col-span-2"><Async q={modules} what="module performance">{(d) => <ModulePerformanceChart data={d} />}</Async></Card>
        <Card title="System status">
          <Async q={summary} what="system status" h="h-40">{(d) => (
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><dt className="text-muted">Backend</dt><dd><OnlineBadge ok={d.system.backend === "online"} label={d.system.backend === "online" ? "ONLINE" : "OFFLINE"} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted">Database</dt><dd><OnlineBadge ok={d.system.database === "connected"} label={d.system.database === "connected" ? "CONNECTED" : "UNAVAILABLE"} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted">Last synchronization</dt>
                <dd className="text-right font-medium" title={formatDateTime(d.system.last_sync_at)}>{relativeTime(d.system.last_sync_at)}</dd></div>
              <div className="border-t border-line pt-2.5">
                <dt className="mb-1 text-muted">Device sync, last 24 h</dt>
                <dd className="num flex gap-4 text-xs"><span><CheckCircle2 className="mr-1 inline h-3 w-3 text-ok-600" aria-hidden />{d.system.sync_last_24h.accepted} accepted</span>
                  <span>{d.system.sync_last_24h.duplicate} duplicate</span><span>{d.system.sync_last_24h.rejected} rejected</span></dd>
              </div>
              <p className="text-[11px] text-muted">{d.system.environment_note}</p>
            </dl>)}</Async>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Recent training activity" action={<Link to="/assessments" className="text-xs font-medium text-steel-700 hover:underline">View all</Link>}>
          <Async q={activity} what="recent activity" h="h-56">{(d) => <ActivityList rows={d} />}</Async></Card>
        <Card title="Recent certificates" action={<Link to="/certificates" className="text-xs font-medium text-steel-700 hover:underline">View all</Link>}>
          <Async q={certs} what="recent certificates" h="h-56">{(d) => <CertList rows={d} />}</Async></Card>
      </div>

      <Card title="Where this dashboard fits"><FlowStrip /></Card>
    </div>
  );
}
