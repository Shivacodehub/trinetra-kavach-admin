import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuth } from "../services/auth";
import { useOrganizations } from "../hooks/useDashboard";
import { Card } from "../components/Card";
import { OnlineBadge } from "../components/StatusBadge";
import { PageHeader } from "../components/PageHeader";
import { formatDateTime, titleCase } from "../utils/format";

export default function SettingsPage() {
  const { admin } = useAuth(), orgs = useOrganizations();
  const health = useQuery({ queryKey: ["health"], queryFn: () => api<{ backend: string; database: string; environment: string; server_time: string }>("/health", { auth: false }) });
  const org = admin?.organization_id ? orgs.data?.find((o) => o.id === admin.organization_id)?.name ?? "Assigned organization" : "All organizations";
  const rows = (items: [string, React.ReactNode][]) => <dl className="space-y-3 text-sm">{items.map(([k, v]) => <div key={k} className="grid grid-cols-3 gap-2"><dt className="text-muted">{k}</dt><dd className="col-span-2 break-words font-medium">{v}</dd></div>)}</dl>;
  const docsUrl = `${window.location.protocol}//${window.location.hostname}:8000/docs`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Settings" subtitle="Administrator profile and system information" />
      <Card title="Admin profile">{rows([["Name", admin?.full_name], ["Email", admin?.email], ["Role", titleCase(admin?.role ?? "")]])}</Card>
      <Card title="Organization access">{rows([["Access scope", org]])}
        <p className="mt-3 text-xs text-muted">Administrators bound to an organization only see that organization's workers and results. This is enforced by the server.</p></Card>
      <Card title="Language and notifications">
        <p className="text-sm text-muted">This prototype's admin interface is in English. Worker-facing language (English, Hindi, Santali) is set per worker on the worker profile and used by the Android app. Notification preferences are not part of the prototype.</p></Card>
      <Card title="System">
        {rows([["Backend", health.data ? <OnlineBadge key="b" ok={health.data.backend === "online"} label={health.data.backend.toUpperCase()} /> : health.isError ? "Unreachable" : "Checking..."],
          ["Database", health.data ? <OnlineBadge key="d" ok={health.data.database === "connected"} label={health.data.database.toUpperCase()} /> : "-"],
          ["Environment", health.data ? `${health.data.environment} (demo data)` : "-"], ["Server time", health.data ? formatDateTime(health.data.server_time) : "-"],
          ["API documentation", <a key="a" className="text-steel-700 hover:underline" href={docsUrl} target="_blank" rel="noreferrer">{docsUrl}</a>]])}
      </Card>
      <Card title="About this prototype"><p className="text-sm text-muted">TRINETRA KAVACH is a prototype that demonstrates AR-based safety training, behavioural assessment, training records, digital certificates and verification. All data shown is demo data. Certificates are training records from this platform's assessment workflow, not government-approved or legally recognised certification. Safety scenarios and pass marks are demo training configuration until validated by qualified safety experts.</p></Card>
    </div>
  );
}
