import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useOrg } from "../services/org";
import type { AttemptRow, CertificateRow, DashboardSummary, ModulePerformance, Organization, TrendPoint } from "../types/api";

/** All dashboard data is fetched from the API and keyed by the selected organization. */
function useDash<T>(key: string, path: string, query: Record<string, string | number> = {}, refetchMs = 60_000) {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ["dashboard", key, orgId, query],
    queryFn: () => api<T>(path, { query: { organization_id: orgId, ...query } }),
    refetchInterval: refetchMs,
  });
}

export const useSummary = () => useDash<DashboardSummary>("summary", "/dashboard/summary");
export const useTrends = () => useDash<TrendPoint[]>("trends", "/dashboard/trends", { days: 30 }, 120_000);
export const useModulePerformance = () => useDash<ModulePerformance[]>("modules", "/dashboard/module-performance", {}, 120_000);
export const useRecentActivity = () => useDash<AttemptRow[]>("activity", "/dashboard/activity", { limit: 8 });
export const useRecentCertificates = () => useDash<CertificateRow[]>("certs", "/dashboard/recent-certificates", { limit: 6 });

export const useOrganizations = () =>
  useQuery({ queryKey: ["organizations"], queryFn: () => api<Organization[]>("/organizations"), staleTime: 5 * 60_000 });
