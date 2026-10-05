import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Shield } from "lucide-react";
import { useAuth } from "../services/auth";
import { ApiError } from "../services/api";
import { Button } from "../components/Button";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";

export default function LoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/dashboard";
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  if (admin) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      toast("success", "Signed in.");
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 429 ? "Too many attempts. Wait a minute and try again." : err.message) : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  const field = "mt-1 h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm";
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <Shield className="h-9 w-9 text-steel-600" aria-hidden />
          <div><h1 className="text-lg font-bold tracking-wider text-ink-900">TRINETRA KAVACH</h1><p className="text-xs text-muted">Safety Training &amp; Compliance</p></div>
        </div>
        <form onSubmit={submit} noValidate className="space-y-3.5">
          {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-bad-600/40 bg-bad-100 p-2.5 text-sm text-bad-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</div>}
          <label className="block text-sm font-medium">Email
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
          <label className="block text-sm font-medium">Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" />Remember me</label>
            <button type="button" onClick={() => setForgot(true)} className="text-steel-700 hover:underline">Forgot password?</button>
          </div>
          <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>Login</Button>
        </form>
        <p className="mt-5 border-t border-line pt-3 text-[11px] leading-snug text-muted">
          Prototype system with demo data. Training certificates issued here are platform training records, not official or government certification.</p>
      </div>
      <ConfirmDialog open={forgot} title="Password reset" confirmLabel="OK" onCancel={() => setForgot(false)} onConfirm={() => setForgot(false)}
        message="Self-service reset is not available in this prototype. Ask a system administrator to reset your password." />
    </div>
  );
}
