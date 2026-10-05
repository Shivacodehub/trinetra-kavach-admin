import { Award, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, ScanLine, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon }
export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/certificates", label: "Certificates", icon: Award },
  { to: "/verify", label: "Verification", icon: ScanLine },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];
export const titleFor = (path: string) => NAV.find((n) => path === n.to || path.startsWith(n.to + "/"))?.label ?? "TRINETRA KAVACH";

