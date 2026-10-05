import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Search, Shield, XCircle } from "lucide-react";
import { api } from "../services/api";
import type { VerifyResponse, VerifyStatus } from "../types/api";
import { Button } from "../components/Button";
import { ErrorState, Skeleton } from "../components/States";
import { useToast } from "../components/Toast";
import { formatDate, formatDateTime } from "../utils/format";

const BANNER: Record<VerifyStatus, { text: string; sub: string; cls: string; Icon: typeof XCircle }> = {
  valid: { text: "VALID CERTIFICATE", sub: "This certificate exists and is currently valid.", cls: "border-ok-600 bg-ok-100 text-ok-700", Icon: CheckCircle2 },
  revoked: { text: "CERTIFICATE REVOKED", sub: "This certificate was issued but has been revoked. It is no longer valid.", cls: "border-bad-600 bg-bad-100 text-bad-700", Icon: XCircle },
  expired: { text: "CERTIFICATE EXPIRED", sub: "This certificate has passed its expiry date.", cls: "border-warn-600 bg-warn-100 text-warn-700", Icon: AlertTriangle },
  invalid: { text: "INVALID CERTIFICATE", sub: "No certificate with this ID exists in the system.", cls: "border-bad-600 bg-bad-100 text-bad-700", Icon: XCircle },
};

/** Public page (no login). Always asks the backend; the result is never hard-coded. */
export default function VerifyPage() {
  const { certificateId = "" } = useParams(), navigate = useNavigate(), toast = useToast();
  const [input, setInput] = useState(certificateId);
  useEffect(() => setInput(certificateId), [certificateId]);
  const q = useQuery({ queryKey: ["verify", certificateId], queryFn: () => api<VerifyResponse>(`/certificates/verify/${encodeURIComponent(certificateId)}`, { auth: false }),
    enabled: !!certificateId, retry: false, staleTime: 0, gcTime: 0 });
  const notified = useRef("");
  useEffect(() => { if (q.data?.valid && notified.current !== certificateId) { notified.current = certificateId; toast("success", "Certificate verified."); } }, [q.data, certificateId, toast]);

  const submit = (e: FormEvent) => { e.preventDefault(); const v = input.trim(); if (v) navigate(`/verify/${encodeURIComponent(v)}`); };
  const r = q.data, b = r ? BANNER[r.status] : null;

  return (
    <div className="min-h-full bg-surface">
      <header className="bg-ink-900 px-4 py-3"><div className="mx-auto flex max-w-2xl items-center gap-2.5 text-white"><Shield className="h-6 w-6 text-steel-500" aria-hidden />
        <div className="leading-tight"><div className="font-bold tracking-wider">TRINETRA KAVACH</div><div className="text-[11px] text-slate-400">Certificate Verification</div></div></div></header>
      <main className="mx-auto max-w-2xl p-4 sm:py-8">
        <form onSubmit={submit} className="mb-4 flex gap-2" role="search">
          <label className="sr-only" htmlFor="cid">Certificate ID</label>
          <input id="cid" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter certificate ID, e.g. CERT-TK-2026-XXXXXXXX" maxLength={64}
            className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 font-mono text-sm" />
          <Button type="submit" disabled={!input.trim()}><Search className="h-4 w-4" aria-hidden />Verify</Button>
        </form>

        {!certificateId && <p className="rounded-md border border-line bg-white p-4 text-sm text-muted">Enter a certificate ID, or scan the QR code on a certificate, to check it against the TRINETRA KAVACH records.</p>}
        {certificateId && q.isPending && <Skeleton className="h-56 w-full" />}
        {q.isError && <div className="rounded-md border border-line bg-white"><ErrorState error={q.error} what="the verification result" onRetry={() => q.refetch()} /></div>}

        {r && b && (
          <section aria-live="polite" className="overflow-hidden rounded-md border border-line bg-white shadow-sm">
            <div className={`flex items-center gap-3 border-b-2 px-5 py-4 ${b.cls}`}><b.Icon className="h-8 w-8 shrink-0" aria-hidden />
              <div><h1 className="text-xl font-bold tracking-wide">{b.text}</h1><p className="text-sm">{b.sub}</p></div></div>
            {r.certificate ? (
              <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
                {([["Certificate ID", <span key="i" className="break-all font-mono">{r.certificate.certificate_id}</span>], ["Worker", r.certificate.worker_name], ["Training", r.certificate.training],
                  ["Score", `${Math.round(r.certificate.score)}%`], ["Result", `✓ ${r.certificate.result}`], ["Issued", formatDate(r.certificate.issued_at)],
                  ["Status", r.status.toUpperCase()], ...(r.certificate.revoked_at ? [["Revoked on", formatDate(r.certificate.revoked_at)] as [string, string]] : [])] as [string, React.ReactNode][])
                  .map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
              </dl>
            ) : <p className="p-5 text-sm">Check the ID for typing mistakes. Certificate IDs look like <span className="font-mono">CERT-TK-2026-XXXXXXXX</span>.</p>}
            <p className="border-t border-line bg-surface px-5 py-3 text-[11px] leading-snug text-muted">{r.disclaimer} Checked {formatDateTime(r.checked_at)}.</p>
          </section>
        )}
        <p className="mt-6 text-center text-xs text-muted"><Link to="/dashboard" className="hover:underline">Administrator sign in</Link> &middot; Prototype system with demo data</p>
      </main>
    </div>
  );
}
