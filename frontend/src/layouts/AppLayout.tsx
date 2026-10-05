import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Search, Shield, X } from "lucide-react";
import { useAuth } from "../services/auth";
import { useOrg } from "../services/org";
import { useOrganizations } from "../hooks/useDashboard";
import { NAV, titleFor } from "../router/nav";
import { IconButton } from "../components/IconButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-ink-900 text-slate-300">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <Shield className="h-7 w-7 text-steel-500" aria-hidden />
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-wider text-white">TRINETRA KAVACH</div>
          <div className="text-[11px] text-slate-400">Safety Training &amp; Compliance</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNavigate}
            className={({ isActive }) => `mb-0.5 flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
              isActive ? "border-steel-500 bg-white/10 font-medium text-white" : "border-transparent hover:bg-white/5 hover:text-white"}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-snug text-slate-400">
        Prototype &middot; Demo data.<br />Training records only; not an official certification.
      </div>
    </div>
  );
}

export function AppLayout() {
  const { admin, logout } = useAuth();
  const { orgId, setOrgId } = useOrg();
  const orgs = useOrganizations();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => { document.title = `${titleFor(pathname)} - TRINETRA KAVACH`; }, [pathname]);

  const lockedOrg = admin?.organization_id ?? "";
  const doLogout = async () => { setConfirmOut(false); await logout(); toast("success", "You have been signed out."); navigate("/login", { replace: true }); };

  return (
    <div className="flex h-full print:block print:h-auto">
      <aside className="hidden w-60 shrink-0 lg:block print:hidden"><Sidebar /></aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDrawer(false)} />
          <aside className="pop-in absolute inset-y-0 left-0 w-64 shadow-xl"><Sidebar onNavigate={() => setDrawer(false)} /></aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-white px-3 py-2 sm:px-5 print:hidden">
          <IconButton label={drawer ? "Close menu" : "Open menu"} onClick={() => setDrawer((d) => !d)} className="lg:hidden">
            {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </IconButton>
          <h1 className="mr-auto text-lg font-semibold text-ink-900">{titleFor(pathname)}</h1>

          <span className="hidden rounded-sm border border-warn-600/40 bg-warn-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-warn-700 sm:inline">DEMO ENVIRONMENT</span>

          <form role="search" className="relative order-last w-full sm:order-none sm:w-56"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/workers?search=${encodeURIComponent(q.trim())}`); }}>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} aria-label="Search workers by name or ID" placeholder="Search workers (name / ID)"
              className="h-9 w-full rounded-md border border-line-strong bg-white pl-8 pr-2 text-sm placeholder:text-muted/70" />
          </form>

          <label className="sr-only" htmlFor="org">Organization</label>
          <select id="org" value={lockedOrg || orgId} disabled={!!lockedOrg} onChange={(e) => setOrgId(e.target.value)}
            className="h-9 max-w-[220px] rounded-md border border-line-strong bg-white px-2 text-sm">
            <option value="">All organizations</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <div className="flex items-center gap-2 border-l border-line pl-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{admin?.full_name}</div>
              <div className="text-[11px] capitalize text-muted">{admin?.role.replace("_", " ")}</div>
            </div>
            <IconButton label="Sign out" onClick={() => setConfirmOut(true)}><LogOut className="h-4 w-4" /></IconButton>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 print:overflow-visible print:p-0"><Outlet /></main>
      </div>

      <ConfirmDialog open={confirmOut} title="Sign out?" message="You will need to sign in again to view training data."
        confirmLabel="Sign out" onConfirm={doLogout} onCancel={() => setConfirmOut(false)} />
    </div>
  );
}
