import { Check, CircleDashed, Clock, Minus, X, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "ok" | "bad" | "warn" | "info" | "idle";
const tones: Record<Tone, string> = {
  ok: "bg-ok-100 text-ok-700 border-ok-600/30", bad: "bg-bad-100 text-bad-700 border-bad-600/30",
  warn: "bg-warn-100 text-warn-700 border-warn-600/30", info: "bg-steel-100 text-steel-700 border-steel-600/30",
  idle: "bg-idle-100 text-idle-600 border-idle-600/30",
};

function Badge({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-semibold tracking-wide ${tones[tone]}`}>{icon}{children}</span>;
}
const i = "h-3 w-3";

/** Status is always icon + text, never colour alone. */
export function ResultBadge({ result }: { result: "pass" | "fail" | null }) {
  if (result === "pass") return <Badge tone="ok" icon={<Check className={i} aria-hidden />}>PASS</Badge>;
  if (result === "fail") return <Badge tone="bad" icon={<X className={i} aria-hidden />}>FAIL</Badge>;
  return <Badge tone="info" icon={<Clock className={i} aria-hidden />}>IN PROGRESS</Badge>;
}

export function CertBadge({ status }: { status: "valid" | "revoked" | "expired" }) {
  if (status === "valid") return <Badge tone="ok" icon={<Check className={i} aria-hidden />}>VALID</Badge>;
  if (status === "revoked") return <Badge tone="bad" icon={<X className={i} aria-hidden />}>REVOKED</Badge>;
  return <Badge tone="warn" icon={<AlertTriangle className={i} aria-hidden />}>EXPIRED</Badge>;
}

export function OnlineBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? <Badge tone="ok" icon={<Check className={i} aria-hidden />}>{label}</Badge>
            : <Badge tone="bad" icon={<X className={i} aria-hidden />}>{label}</Badge>;
}
export const NeutralBadge = ({ children }: { children: ReactNode }) => <Badge tone="idle" icon={<Minus className={i} aria-hidden />}>{children}</Badge>;
export const DemoBadge = () => <Badge tone="warn" icon={<CircleDashed className={i} aria-hidden />}>DEMO</Badge>;

export function TrainingStatusBadge({ status }: { status: "not_started" | "in_progress" | "completed" }) {
  if (status === "completed") return <Badge tone="ok" icon={<Check className={i} aria-hidden />}>COMPLETED</Badge>;
  if (status === "in_progress") return <Badge tone="info" icon={<Clock className={i} aria-hidden />}>IN PROGRESS</Badge>;
  return <Badge tone="idle" icon={<Minus className={i} aria-hidden />}>NOT STARTED</Badge>;
}
export function WorkerCertBadge({ status }: { status: "none" | "partial" | "certified" }) {
  if (status === "certified") return <Badge tone="ok" icon={<Check className={i} aria-hidden />}>CERTIFIED</Badge>;
  if (status === "partial") return <Badge tone="warn" icon={<AlertTriangle className={i} aria-hidden />}>PARTIAL</Badge>;
  return <Badge tone="idle" icon={<Minus className={i} aria-hidden />}>NONE</Badge>;
}
export function ComplianceBadge({ status }: { status: "COMPLIANT" | "TRAINING_DUE" | "FAILED" | "NOT_STARTED" }) {
  if (status === "COMPLIANT") return <Badge tone="ok" icon={<Check className={i} aria-hidden />}>COMPLIANT</Badge>;
  if (status === "TRAINING_DUE") return <Badge tone="warn" icon={<Clock className={i} aria-hidden />}>TRAINING DUE</Badge>;
  if (status === "FAILED") return <Badge tone="bad" icon={<X className={i} aria-hidden />}>FAILED</Badge>;
  return <Badge tone="idle" icon={<Minus className={i} aria-hidden />}>NOT STARTED</Badge>;
}
export function RiskBadge({ risk }: { risk: "low" | "medium" | "high" | "critical" }) {
  const tone: Tone = { low: "idle", medium: "warn", high: "bad", critical: "bad" }[risk] as Tone;
  return <Badge tone={tone} icon={risk === "critical" || risk === "high" ? <AlertTriangle className={i} aria-hidden /> : <Minus className={i} aria-hidden />}>{risk.toUpperCase()} RISK</Badge>;
}
