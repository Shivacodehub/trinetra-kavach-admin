import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { Admin, LoginResponse } from "../types/api";

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const reset = useCallback(() => { tokenStore.clear(); setAdmin(null); qc.clear(); }, [qc]);

  useEffect(() => { setUnauthorizedHandler(reset); }, [reset]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<Admin>("/auth/me").then(setAdmin).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const r = await api<LoginResponse>("/auth/login", { method: "POST", auth: false, body: { email, password, remember_me: remember } });
    tokenStore.set(r.access_token, r.expires_in, remember);
    setAdmin(r.admin);
  }, []);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* token may already be invalid */ }
    reset();
  }, [reset]);

  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
