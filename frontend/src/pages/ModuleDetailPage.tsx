import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Percent, Target, Users } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import type { ModuleAnalytics } from "../types/api";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { ModuleTimeChart, OrgPerformanceChart, ScoreDistributionChart, WorkerPerformanceChart } from "../charts/ModuleCharts";
import { PassFailChart } from "../charts/PassFailChart";
import { formatDuration, formatScore, METRIC_LABELS, titleCase } from "../utils/format";

export default function ModuleDetailPage() {
  const { id = "" } = useParams(), { orgId } = useOrg();
  const q = useQuery({ queryKey: ["module", id, orgId], queryFn: () => api<ModuleAnalytics>(`/modules/${id}`, { query: { organization_id: orgId } }), retry: false });
  if (q.isPending) return <div className="mx-auto max-w-[1300px] space-y-3"><Skeleton className="h-10 w-80" /><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  if (q.isError) return <Card className="mx-auto max-w-xl"><ErrorState error={q.error} what="module analytics" onRetry={() => q.refetch()} /></Card>;
  const m = q.data, noData = m.completed_attempts === 0;

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader back={{ to: "/training", label: "Training Modules" }} title={m.name}
        subtitle={<>{m.description} <span className="ml-1 rounded-sm border border-warn-600/40 bg-warn-100 px-1.5 py-0.5 text-[11px] font-semibold text-warn-700">{m.config_label.toUpperCase()}</span> Pass mark {m.pass_mark}%</>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total attempts" value={m.total_attempts} icon={Activity} />
        <KpiCard label="Completed" value={m.completed_attempts} icon={CheckCircle2} hint={`${m.completion_rate}% completion`} />
        <KpiCard label="Pass rate" value={`${m.pass_rate}%`} icon={Percent} />
        <KpiCard label="Average score" value={formatScore(m.average_score)} icon={Target} />
        <KpiCard label="Avg completion time" value={formatDuration(m.average_duration_seconds)} icon={Clock} hint="mm:ss" />
        <KpiCard label="Workers trained" value={m.workers_trained} icon={Users} />
      </div>
      {noData ? <Card><EmptyState message="No completed assessments for this module yet." /></Card> : <>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Score distribution" className="xl:col-span-2"><ScoreDistributionChart data={m.score_distribution} /></Card>
          <Card title="Pass vs fail"><PassFailChart passed={m.pass_fail.passed} failed={m.pass_fail.failed} /></Card>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title="Common failure areas">
            {!m.common_failure_areas.length ? <EmptyState message="No incorrect actions recorded." /> : (
              <ul className="space-y-3">{m.common_failure_areas.map((f) => (
                <li key={f.event_type}>
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-medium">{titleCase(f.event_type)}</span>
                    <span className="num shrink-0 text-xs text-muted">{f.incorrect} of {f.occurrences} incorrect &middot; <b className="text-bad-700">{f.failure_rate}%</b></span></div>
                  <div className="mt-1 h-1.5 rounded-sm bg-idle-100"><div className="h-1.5 rounded-sm bg-bad-600" style={{ width: `${Math.min(100, f.failure_rate)}%` }} /></div>
                  <p className="mt-0.5 text-xs text-muted">Expected: {f.expected_action}{f.category ? ` (${METRIC_LABELS[f.category] ?? f.category})` : ""}</p>
                </li>))}</ul>)}
          </Card>
          <Card title="Performance over time (30 days)"><ModuleTimeChart data={m.over_time} /></Card>
          <Card title="Performance by organization"><OrgPerformanceChart data={m.by_organization} /></Card>
          <Card title="Performance by worker (top 12 by average score)"><WorkerPerformanceChart data={m.by_worker} /></Card>
        </div>
      </>}
      <Card title="Scenarios in this module" className="mt-4"><ul className="flex flex-wrap gap-2">{m.scenarios.map((s) => <li key={s.id} className="rounded-sm border border-line-strong bg-surface px-2 py-1 text-sm">{s.name}</li>)}</ul></Card>
    </div>
  );
}
