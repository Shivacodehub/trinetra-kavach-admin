import type { LucideIcon } from "lucide-react";
import { Skeleton } from "./States";

export function KpiCard({ label, value, hint, icon: Icon, loading, tone = "default" }:
  { label: string; value: string | number | undefined; hint?: string; icon: LucideIcon; loading?: boolean; tone?: "default" | "warn" | "bad" }) {
  const bar = { default: "bg-steel-600", warn: "bg-warn-600", bad: "bg-bad-600" }[tone];
  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,30,51,.05)]">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <Icon className="h-4 w-4 text-muted" aria-hidden />
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-20" /> : <div className="num mt-1 text-3xl font-semibold text-ink-900">{value ?? "-"}</div>}
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
