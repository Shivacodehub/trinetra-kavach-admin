import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Organization filter shared by every page ("" = all organizations). */
const Ctx = createContext<{ orgId: string; setOrgId: (id: string) => void }>({ orgId: "", setOrgId: () => {} });

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgId, setOrgId] = useState("");
  const value = useMemo(() => ({ orgId, setOrgId }), [orgId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useOrg = () => useContext(Ctx);
