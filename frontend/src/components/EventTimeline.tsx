import { Check, X } from "lucide-react";
import type { AssessmentEvent } from "../types/api";
import { formatTime } from "../utils/format";
import { RiskBadge } from "./StatusBadge";

/** Vertical timeline of the worker's evaluated actions, as sent by the Android assessment engine. */
export function EventTimeline({ events }: { events: AssessmentEvent[] }) {
  return (
    <ol className="relative">{events.map((e, idx) => {
      const impact = `${e.score_impact > 0 ? "+" : ""}${e.score_impact.toFixed(1)} / ${e.points_possible.toFixed(1)}`;
      return (
        <li key={e.sequence} className="relative flex gap-3 pb-4 last:pb-0">
          {idx < events.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-line-strong" aria-hidden />}
          <span className={`z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white ${e.is_correct ? "border-ok-600 text-ok-600" : "border-bad-600 text-bad-600"}`}>
            {e.is_correct ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
          </span>
          <div className={`min-w-0 flex-1 rounded-md border p-3 ${e.is_correct ? "border-line bg-white" : "border-bad-600/40 bg-bad-100/40"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="num font-mono text-xs font-semibold">{formatTime(e.timestamp)}</span>
              <span className="num text-xs text-muted">+{e.elapsed_seconds}s</span>
              <span className="font-mono text-[11px] text-muted">{e.event_type}</span>
              <span className={`ml-auto text-xs font-semibold ${e.is_correct ? "text-ok-700" : "text-bad-700"}`}>{e.is_correct ? "✓ CORRECT" : "✕ INCORRECT"}</span>
            </div>
            <p className="mt-1 text-sm font-medium">{e.action_taken}</p>
            <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div><dt className="text-muted">Expected action</dt><dd>{e.expected_action}</dd></div>
              <div><dt className="text-muted">Score impact</dt><dd className="num font-medium">{impact}</dd></div>
              <div><dt className="text-muted">Risk level</dt><dd><RiskBadge risk={e.risk_level} /></dd></div>
            </dl>
          </div>
        </li>);
    })}</ol>
  );
}
