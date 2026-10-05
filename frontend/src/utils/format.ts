const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "-");
export const formatDateTime = (iso: string | null | undefined) => (iso ? `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}` : "-");
export const formatScore = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${Math.round(n)}%`);

export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "-";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
export const LANGUAGES: Record<string, string> = { en: "English", hi: "Hindi", sat: "Santali" };
export const METRIC_LABELS: Record<string, string> = {
  hazard_recognition: "Hazard recognition", procedure_adherence: "Procedure adherence", decision_making: "Decision making",
  response_time: "Response time", route_selection: "Route selection", safety_compliance: "Safety compliance",
};
export const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const shortId = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}...${s.slice(-4)}` : s);
