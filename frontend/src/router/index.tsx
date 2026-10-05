import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from "react-router-dom";
import { useAuth } from "../services/auth";
import { AppLayout } from "../layouts/AppLayout";
import { Skeleton } from "../components/States";
import LoginPage from "../pages/LoginPage";
import NotFoundPage from "../pages/NotFoundPage";

/** Frontend guard is only for UX; every API call is authorised again by the backend. */
function RequireAuth() {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Pages are code-split: charts and tables only download when a page is opened. */
const page = (load: () => Promise<{ default: React.ComponentType }>) => ({ lazy: async () => ({ Component: (await load()).default }) });

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    hydrateFallbackElement: <div className="p-8"><Skeleton className="h-8 w-48" /></div>,
    children: [{
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: "dashboard", ...page(() => import("../pages/DashboardPage")) },
        { path: "workers", ...page(() => import("../pages/WorkersPage")) },
        { path: "workers/:id", ...page(() => import("../pages/WorkerProfilePage")) },
        { path: "training", ...page(() => import("../pages/TrainingPage")) },
        { path: "training/:id", ...page(() => import("../pages/ModuleDetailPage")) },
        { path: "assessments", ...page(() => import("../pages/AssessmentsPage")) },
        { path: "assessments/:id", ...page(() => import("../pages/AssessmentDetailPage")) },
        { path: "compliance", ...page(() => import("../pages/CompliancePage")) },
        { path: "certificates", ...page(() => import("../pages/CertificatesPage")) },
        { path: "certificates/:id", ...page(() => import("../pages/CertificateDetailPage")) },
        { path: "reports", ...page(() => import("../pages/ReportsPage")) },
        { path: "settings", ...page(() => import("../pages/SettingsPage")) },
      ],
    }],
  },
  { path: "/verify", ...page(() => import("../pages/VerifyPage")) },
  { path: "/verify/:certificateId", ...page(() => import("../pages/VerifyPage")) },
  { path: "*", element: <NotFoundPage /> },
];
export const router = createBrowserRouter(routes);
