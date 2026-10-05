import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Wind, Cog, GraduationCap, type LucideIcon } from "lucide-react";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import type { ModuleStats } from "../types/api";
import { Card } from "../components/Card";
import { ErrorState, Skeleton } from "../components/States";
import { PageHeader } from "../components/PageHeader";
import { formatScore } from "../utils/format";

const ICONS: Record<string, LucideIcon> = { FIRE: Flame, GAS: Wind, MACH: Cog };

export default function TrainingPage() {
  const { orgId } = useOrg();
  const q = useQuery({ queryKey: ["modules", orgId], queryFn: () => api<ModuleStats[]>("/modules", { query: { organization_id: orgId } }) });
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Training Modules" subtitle="Performance of each module, from synced assessment results. Select a module for detailed analytics." />
      {q.isError && <Card><ErrorState error={q.error} what="training modules" onRetry={() => q.refetch()} /></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {q.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-60" />)}
        {q.data?.map((m) => {
          const Icon = ICONS[m.code] ?? GraduationCap;
          const stats: [string, string | number][] = [["Workers trained", m.workers_trained], ["Completion", `${m.completion_rate}%`], ["Average score", formatScore(m.average_score)], ["Pass rate", `${m.pass_rate}%`]];
          return (
            <Link key={m.id} to={`/training/${m.id}`} className="group block rounded-md border border-line bg-white shadow-[0_1px_2px_rgba(16,30,51,.05)] hover:border-steel-600">
              <div className="flex items-start gap-3 border-b border-line p-4">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-steel-600" aria-hidden />
                <div><h3 className="text-[15px] font-semibold uppercase leading-tight tracking-wide text-ink-900">{m.name}</h3><p className="mt-1 text-sm text-muted">{m.description}</p></div>
              </div>
              <dl className="grid grid-cols-2 gap-3 p-4">{stats.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt><dd className="num text-xl font-semibold">{v}</dd></div>)}</dl>
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
                <span>{m.scenarios.length} scenarios &middot; {m.config_label}</span>
                <span className="flex items-center gap-1 font-medium text-steel-700">Analytics<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              </div>
            </Link>);
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Completion = completed attempts / started attempts. Pass rate = passed / scored attempts. Pass marks and scenario content are demo training configuration, not validated safety standards.</p>
    </div>
  );
}
