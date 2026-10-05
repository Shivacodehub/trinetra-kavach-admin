import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ExternalLink, Printer, Shield } from "lucide-react";
import { api, ApiError, apiBlob } from "../services/api";
import type { CertificateDetail } from "../types/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, TextInput } from "../components/Fields";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, Skeleton } from "../components/States";
import { CertBadge, DemoBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { formatDate, formatDateTime } from "../utils/format";

function QrImage({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["qr", id], queryFn: async () => URL.createObjectURL(await apiBlob(`/certificates/${id}/qr.svg`)), staleTime: Infinity, gcTime: 60_000 });
  if (q.isPending) return <Skeleton className="h-32 w-32" />;
  if (q.isError) return <div className="flex h-32 w-32 items-center justify-center border border-line p-2 text-center text-xs text-bad-700">QR unavailable</div>;
  return <img src={q.data} alt={`QR code for certificate ${id}`} className="h-32 w-32" />;
}

export default function CertificateDetailPage() {
  const { id = "" } = useParams(), qc = useQueryClient(), toast = useToast(), [sp] = useSearchParams();
  const [revoking, setRevoking] = useState(false), [reason, setReason] = useState(""), [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["cert", id], queryFn: () => api<CertificateDetail>(`/certificates/${id}`), retry: false });
  const printed = useRef(false);
  useEffect(() => { if (q.data && sp.get("print") === "1" && !printed.current) { printed.current = true; setTimeout(() => window.print(), 600); } }, [q.data, sp]);

  const revoke = useMutation({
    mutationFn: () => api(`/certificates/${id}/revoke`, { method: "POST", body: { reason: reason.trim() } }),
    onSuccess: () => { ["cert", "certificates", "certstats", "dashboard", "compliance"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast("success", "Certificate revoked. Public verification now reports it as revoked."); setRevoking(false); setReason(""); },
    onError: (e) => setErr(e instanceof ApiError ? (e.details?.[0]?.message ?? e.message) : "Unable to revoke the certificate."),
  });

  if (q.isPending) return <div className="mx-auto max-w-4xl space-y-3"><Skeleton className="h-10 w-72" /><Skeleton className="h-[460px]" /></div>;
  if (q.isError) return <Card className="mx-auto max-w-xl"><ErrorState error={q.error} what="this certificate" onRetry={() => q.refetch()} /></Card>;
  const c = q.data, bad = c.status !== "valid";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back={{ to: "/certificates", label: "Certificate Management" }} title="Certificate detail"
        actions={<>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print / save as PDF</Button>
          <a href={`/verify/${c.certificate_id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-white px-4 text-sm font-medium hover:bg-surface"><ExternalLink className="h-4 w-4" aria-hidden />Public verification</a>
          {c.status === "valid" && <Button variant="danger" onClick={() => { setErr(null); setRevoking(true); }}><Ban className="h-4 w-4" aria-hidden />Revoke</Button>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className={`relative rounded-md border-2 bg-white p-2 ${bad ? "border-bad-600" : "border-ink-800"}`}>
          <div className="border border-line-strong px-5 py-8 text-center sm:px-10">
            <Shield className="mx-auto h-10 w-10 text-steel-700" aria-hidden />
            <p className="mt-2 text-xl font-bold tracking-[0.25em] text-ink-900">TRINETRA KAVACH</p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-widest text-muted">Certificate of Safety Training</h3>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-warn-700">Prototype training certificate</p>
            <p className="mt-8 text-sm text-muted">This certifies that</p>
            <p className="mt-1 text-3xl font-semibold uppercase tracking-wide text-ink-900">{c.worker.name}</p>
            <p className="mt-6 text-sm text-muted">has successfully completed the training module</p>
            <p className="mt-1 text-xl font-semibold uppercase text-steel-700">{c.module.name}</p>
            {c.scenario && <p className="mt-0.5 text-xs text-muted">Assessed scenario: {c.scenario}</p>}
            <dl className="mx-auto mt-7 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-left text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Assessment score</dt><dd className="num text-lg font-semibold">{Math.round(c.score)}%</dd></div>
              <div><dt className="text-xs text-muted">Result</dt><dd className="text-lg font-semibold text-ok-700">✓ PASS</dd></div>
              <div><dt className="text-xs text-muted">Issue date</dt><dd className="font-semibold">{formatDate(c.issued_at)}</dd></div>
            </dl>
            <div className="mt-8 flex flex-col items-center justify-between gap-5 border-t border-line pt-5 sm:flex-row sm:items-end">
              <div className="text-left"><p className="text-xs text-muted">Certificate ID</p><p className="break-all font-mono text-sm font-semibold">{c.certificate_id}</p>
                <p className="mt-2 text-xs text-muted">Verification status</p><p className="mt-0.5"><CertBadge status={c.status} /></p></div>
              <div className="flex flex-col items-center"><QrImage id={c.certificate_id} /><p className="mt-1 max-w-[150px] text-[10px] text-muted">Scan to verify. The QR holds only the verification link.</p></div>
            </div>
            <p className="mx-auto mt-6 max-w-lg text-[10px] leading-snug text-muted">{c.disclaimer}</p>
          </div>
          {bad && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="-rotate-12 rounded-md border-4 border-bad-600/70 px-4 py-1 text-4xl font-black tracking-widest text-bad-600/70">{c.status.toUpperCase()}</span></div>}
        </div>

        <aside className="space-y-4 print:hidden">
          <Card title="Record"><dl className="space-y-2.5 text-sm">
            <div><dt className="text-xs text-muted">Status</dt><dd><CertBadge status={c.status} /> {c.is_demo && <DemoBadge />}</dd></div>
            <div><dt className="text-xs text-muted">Worker</dt><dd><Link className="font-medium text-steel-700 hover:underline" to={`/workers/${c.worker.id}`}>{c.worker.name} ({c.worker.worker_code})</Link></dd></div>
            <div><dt className="text-xs text-muted">Organization</dt><dd>{c.worker_organization}</dd></div>
            <div><dt className="text-xs text-muted">Assessment</dt><dd><Link className="font-medium text-steel-700 hover:underline" to={`/assessments/${c.attempt_id}`}>View event timeline</Link></dd></div>
            <div><dt className="text-xs text-muted">Expires</dt><dd>{c.expires_at ? formatDate(c.expires_at) : "No expiry configured"}</dd></div>
            <div><dt className="text-xs text-muted">Public verifications</dt><dd>{c.verification_count}{c.last_verified_at ? ` (last ${formatDateTime(c.last_verified_at)})` : ""}</dd></div>
            {c.status === "revoked" && <div><dt className="text-xs text-muted">Revoked</dt><dd>{formatDate(c.revoked_at)}: {c.revoked_reason}</dd></div>}
          </dl></Card>
        </aside>
      </div>

      <Modal open={revoking} title="Revoke certificate" onClose={() => setRevoking(false)}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setErr(null); if (reason.trim().length < 3) return setErr("Enter a reason (at least 3 characters)"); revoke.mutate(); }}>
          <p className="text-sm text-muted">After revocation, the public verification page will show this certificate as <b>REVOKED</b>. This is recorded in the audit log.</p>
          <Field label="Reason *" error={err ?? undefined}><TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setRevoking(false)}>Cancel</Button><Button type="submit" variant="danger" loading={revoke.isPending}>Revoke certificate</Button></div>
        </form>
      </Modal>
    </div>
  );
}
