import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, ApiError, apiBlob } from "../services/api";
import { useOrg } from "../services/org";
import { useFilters } from "../hooks/useFilters";
import type { ReportResponse } from "../types/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { Field, SelectInput, TextInput } from "../components/Fields";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";

const KINDS = [
  { key: "training", label: "Training completion report", desc: "Every training attempt with status, score and result." },
  { key: "assessment", label: "Assessment report", desc: "Scored assessments with the six behavioural metrics." },
  { key: "workers", label: "Worker performance report", desc: "Per-worker assessments, average score, pass rate and modules passed." },
  { key: "modules", label: "Module performance report", desc: "Per-module assessments, average score, pass rate and workers." },
  { key: "certificates", label: "Certificate report", desc: "Certificates issued in the period with status." },
] as const;
const RANGES = [["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom range"], ["all", "All time"]] as const;

export default function ReportsPage() {
  const f = useFilters(), { orgId } = useOrg(), toast = useToast();
  const kind = f.get("kind") || "training", range = f.get("range") || "30d", from = f.get("from"), to = f.get("to");
  const [exporting, setExporting] = useState(false);
  const customReady = range !== "custom" || !!(from || to);
  const query = { range, date_from: range === "custom" ? from : "", date_to: range === "custom" ? to : "", organization_id: orgId };
  const q = useQuery({ queryKey: ["report", kind, query], queryFn: () => api<ReportResponse>(`/reports/${kind}`, { query }), enabled: customReady });

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await apiBlob(`/reports/${kind}`, { ...query, format: "csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `trinetra-${kind}-report.csv`; a.click(); URL.revokeObjectURL(a.href);
      toast("success", "Report exported as CSV.");
    } catch (e) { toast("error", e instanceof ApiError ? e.message : "Unable to export the report. Try again."); }
    finally { setExporting(false); }
  }
  const active = KINDS.find((k) => k.key === kind) ?? KINDS[0];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Reports" subtitle="Filter by period, preview, and export as CSV"
        actions={<Button onClick={exportCsv} loading={exporting} disabled={!q.data?.total}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Report" hint={active.desc}><SelectInput value={kind} onChange={(e) => f.set({ kind: e.target.value, range, from, to })}>{KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</SelectInput></Field>
          <Field label="Period"><SelectInput value={range} onChange={(e) => f.set({ kind, range: e.target.value, from, to })}>{RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput></Field>
          {range === "custom" && <>
            <Field label="From"><TextInput type="date" value={from} onChange={(e) => f.set({ kind, range, from: e.target.value, to })} /></Field>
            <Field label="To"><TextInput type="date" value={to} onChange={(e) => f.set({ kind, range, from, to: e.target.value })} /></Field></>}
        </div>
        {!customReady && <p className="mt-3 text-sm text-warn-700">Choose a start and/or end date for the custom range.</p>}
      </Card>
      <Card title={`${active.label}${q.data ? ` - ${q.data.total} rows` : ""}`} bodyClass="">
        {q.isError ? <ErrorState error={q.error} what="the report" onRetry={() => q.refetch()} />
          : !customReady ? <EmptyState message="Select a date range to run this report." />
          : q.isPending ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          : !q.data.rows.length ? <EmptyState message="No records in this period. Try a wider range." />
          : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-sm">
              <thead className="border-b border-line bg-surface/60 text-left text-[11px] uppercase tracking-wide text-muted"><tr>{q.data.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
              <tbody>{q.data.rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0 hover:bg-steel-100/40">{r.map((v, j) => <td key={j} className="num px-3 py-2">{v === null || v === "" ? "-" : String(v)}</td>)}</tr>)}</tbody></table></div>}
        {q.data?.truncated && <p className="border-t border-line px-4 py-2 text-xs text-muted">Showing the first 500 of {q.data.total} rows. The CSV export contains all rows.</p>}
      </Card>
      <p className="mt-3 text-xs text-muted">Prototype / demo data. Exports contain worker names and IDs, so handle the files as sensitive operational data.</p>
    </div>
  );
}
