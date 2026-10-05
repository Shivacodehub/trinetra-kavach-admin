import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, Clock, ListChecks, Target, Timer } from "lucide-react";
import { api } from "../services/api";
import type { AssessmentDetail } from "../types/api";
import { Card } from "../components/Card";
import { EventTimeline } from "../components/EventTimeline";
import { KpiCard } from "../components/KpiCard";
import { MetricBars } from "../components/MetricBars";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, Skeleton } from "../components/States";
import { DemoBadge, ResultBadge } from "../components/StatusBadge";
import { formatDateTime, formatDuration, formatScore } from "../utils/format";

export default function AssessmentDetailPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => api<AssessmentDetail>(`/assessments/${id}`), retry: false });
  if (q.isPending) return <div className="mx-auto max-w-[1200px] space-y-3"><Skeleton className="h-10 w-80" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  if (q.isError) return <Card className="mx-auto max-w-xl"><ErrorState error={q.error} what="this assessment" onRetry={() => q.refetch()} /></Card>;
  const a = q.data;
  const rows: [string, React.ReactNode][] = [
    ["Worker", <Link key="w" className="font-medium text-steel-700 hover:underline" to={`/workers/${a.worker.id}`}>{a.worker.name} ({a.worker.worker_code})</Link>],
    ["Organization", a.worker.organization], ["Module", a.module.name], ["Scenario", a.scenario.name],
    ["Start time", formatDateTime(a.started_at)], ["End time", formatDateTime(a.ended_at)],
    ["Attempt ID", <span key="i" className="break-all font-mono text-xs">{a.attempt_id}</span>], ["Language", a.language ?? "-"],
  ];
  const mismatch = a.client_reported_score !== null && Math.abs(a.client_reported_score - (a.score ?? 0)) > 1;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader back={{ to: "/assessments", label: "Assessment Results" }} title="Assessment summary" subtitle={<span className="flex items-center gap-2">{a.module.name} - {a.scenario.name} {a.is_demo && <DemoBadge />}</span>}
        actions={a.certificate_id ? <Link to={`/certificates/${a.certificate_id}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-steel-700 px-4 text-sm font-medium text-white hover:bg-steel-600"><Award className="h-4 w-4" aria-hidden />View certificate</Link> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Final score" value={formatScore(a.score)} icon={Target} hint={`Pass mark ${a.pass_mark}%`} tone={a.result === "fail" ? "bad" : "default"} />
        <div className="flex items-center justify-between rounded-md border border-line bg-white p-4"><div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Result</div><div className="mt-2 text-lg"><ResultBadge result={a.result} /></div></div></div>
        <KpiCard label="Duration" value={formatDuration(a.duration_seconds)} icon={Timer} hint="mm:ss" />
        <KpiCard label="Correct actions" value={`${a.events_correct} / ${a.events_total}`} icon={ListChecks} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:order-2">
          <Card title="Summary"><dl className="space-y-2.5 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
          <Card title="Behavioural performance"><MetricBars metrics={a.behavior_metrics} /></Card>
          <p className="flex gap-1.5 text-xs text-muted"><Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Score is derived by the server from the stored events{mismatch ? <b className="text-warn-700"> (the app reported {formatScore(a.client_reported_score)}, which differs)</b> : ""}. {a.config_label}.</p>
        </div>
        <Card title={`Event timeline (${a.events_total} events)`} className="lg:col-span-2 lg:order-1">
          <p className="mb-3 text-xs text-muted">Each action the worker took in the AR scenario, evaluated by the on-device assessment engine.</p>
          <EventTimeline events={a.events} />
        </Card>
      </div>
    </div>
  );
}
