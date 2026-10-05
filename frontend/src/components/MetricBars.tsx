import { METRIC_LABELS } from "../utils/format";
import { EmptyState } from "./States";

const ORDER = Object.keys(METRIC_LABELS);

export function MetricBars({ metrics }: { metrics: Record<string, number> | null | undefined }) {
  const keys = ORDER.filter((k) => metrics && k in metrics).concat(Object.keys(metrics ?? {}).filter((k) => !ORDER.includes(k)));
  if (!keys.length) return <EmptyState message="No behavioural assessment data recorded yet." />;
  return (
    <ul className="space-y-3">{keys.map((k) => {
      const v = metrics![k];
      const tone = v >= 80 ? "bg-ok-600" : v >= 60 ? "bg-warn-600" : "bg-bad-600";
      return (
        <li key={k}>
          <div className="mb-1 flex justify-between text-sm"><span>{METRIC_LABELS[k] ?? k}</span><span className="num font-semibold">{v}%</span></div>
          <div className="h-2 rounded-sm bg-idle-100" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={METRIC_LABELS[k] ?? k}>
            <div className={`h-2 rounded-sm ${tone}`} style={{ width: `${v}%` }} />
          </div>
        </li>);
    })}
      <li className="pt-1 text-[11px] text-muted">Derived from the correctness of the matching assessment events. Bars below 60% need attention.</li>
    </ul>
  );
}
