/** Integration smoke test: renders every page with real API data from a running backend and fails on React errors. */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./services/auth";
import { OrgProvider } from "./services/org";
import { ToastProvider } from "./components/Toast";
import { api, tokenStore } from "./services/api";
import { routes } from "./router";
import type { AttemptRow, CertificateRow, LoginResponse, ModuleStats, Paged, WorkerRow } from "./types/api";

// jsdom has no ResizeObserver (Recharts needs one); real browsers do.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const ids = { worker: "", attempt: "", module: "", valid: "", revoked: "" };
const errors: unknown[][] = [];

beforeAll(async () => {
  const r = await api<LoginResponse>("/auth/login", { method: "POST", auth: false, body: { email: "admin@trinetra.local", password: "Demo@12345" } });
  tokenStore.set(r.access_token, r.expires_in, false);
  ids.worker = (await api<Paged<WorkerRow>>("/workers", { query: { search: "WK-001" } })).items[0].id;
  ids.attempt = (await api<Paged<AttemptRow>>("/assessments", { query: { page_size: 1 } })).items[0].id;
  ids.module = (await api<ModuleStats[]>("/modules"))[0].id;
  const certs = (await api<Paged<CertificateRow>>("/certificates", { query: { page_size: 100 } })).items;
  ids.valid = certs.find((c) => c.status === "valid")!.certificate_id;
  ids.revoked = certs.find((c) => c.status === "revoked")!.certificate_id;
  vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x.slice(0, 160) : "")).filter(Boolean)); });
});
afterEach(() => { cleanup(); });

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={client}><ToastProvider><AuthProvider><OrgProvider><RouterProvider router={router} /></OrgProvider></AuthProvider></ToastProvider></QueryClientProvider>);
}

const cases: [string, () => string, string | RegExp][] = [
  ["dashboard", () => "/dashboard", "Failed assessments"],
  ["workers list", () => "/workers", "Worker Management"],
  ["workers search", () => "/workers?search=ramesh", "Ramesh Kumar"],
  ["worker profile", () => `/workers/${ids.worker}`, "Behavioural performance"],
  ["training", () => "/training", "Fire & Explosion Response"],
  ["module analytics", () => `/training/${ids.module}`, "Common failure areas"],
  ["assessments", () => "/assessments", "Assessment Results"],
  ["assessment timeline", () => `/assessments/${ids.attempt}`, /Event timeline/],
  ["compliance", () => "/compliance", "Compliance Monitoring"],
  ["certificates", () => "/certificates", "Certificate Management"],
  ["certificate detail", () => `/certificates/${ids.valid}`, "Certificate of Safety Training"],
  ["reports", () => "/reports", /Training completion report - \d+ rows/],
  ["settings", () => "/settings", "About this prototype"],
  ["verify valid", () => `/verify/${ids.valid}`, "VALID CERTIFICATE"],
  ["verify revoked", () => `/verify/${ids.revoked}`, "CERTIFICATE REVOKED"],
  ["verify invalid", () => "/verify/CERT-TK-2026-NOPE0000", "INVALID CERTIFICATE"],
];

describe("pages render real data", () => {
  for (const [name, path, expected] of cases) {
    it(name, async () => {
      errors.length = 0;
      renderAt(path());
      await waitFor(() => expect(screen.getAllByText(expected).length).toBeGreaterThan(0), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 150));
      expect(errors, `console.error during ${name}: ${JSON.stringify(errors).slice(0, 400)}`).toHaveLength(0);
    });
  }

  it("redirects to login without a token", async () => {
    const saved = tokenStore.get()!;
    tokenStore.clear();
    renderAt("/workers");
    await waitFor(() => expect(screen.getByRole("button", { name: "Login" })).toBeTruthy());
    tokenStore.set(saved, 3600, false);
  });
});

// These write to the database (create a worker, revoke a certificate), so they only run when asked:
//   VITE_RUN_MUTATING_TESTS=1 npm test      (afterwards: python -m app.seed --reset)
describe.skipIf(!import.meta.env.VITE_RUN_MUTATING_TESTS)("interactions (write to the database)", () => {
  it("shows validation errors, then creates a worker through the form", async () => {
    renderAt("/workers");
    fireEvent.click(await screen.findByRole("button", { name: /Add worker/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create worker" }));
    expect(await within(dialog).findByText("Enter the worker's name")).toBeTruthy();
    expect(within(dialog).getByText("Select an organization")).toBeTruthy();

    const code = `WK-T${Date.now() % 100000}`;
    const org = (await api<{ id: string }[]>("/organizations"))[0].id;
    const inputs = dialog.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Interaction Test Worker" } });
    fireEvent.change(inputs[1], { target: { value: code } });
    fireEvent.change(dialog.querySelectorAll("select")[0], { target: { value: org } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create worker" }));
    await waitFor(() => expect(screen.getAllByText("Interaction Test Worker").length).toBeGreaterThan(0), { timeout: 10000 });
    const created = (await api<Paged<WorkerRow>>("/workers", { query: { search: code } })).items;
    expect(created).toHaveLength(1);  // confirmed in the database through the API

    // duplicate Worker ID is rejected by the server and shown on the field
    cleanup();
    renderAt("/workers");
    fireEvent.click(await screen.findByRole("button", { name: /Add worker/ }));
    const d2 = await screen.findByRole("dialog");
    await waitFor(() => expect(d2.querySelectorAll("select")[0].options.length).toBeGreaterThan(1)); // organizations loaded
    const i2 = d2.querySelectorAll("input");
    fireEvent.change(i2[0], { target: { value: "Duplicate Person" } });
    fireEvent.change(i2[1], { target: { value: code } });
    fireEvent.change(d2.querySelectorAll("select")[0], { target: { value: org } });
    fireEvent.click(within(d2).getByRole("button", { name: "Create worker" }));
    await waitFor(() => expect(d2.textContent, `dialog text: ${d2.textContent}`).toMatch(/already exists/), { timeout: 5000 });
  });

  it("revokes a certificate and the public page then reports REVOKED", async () => {
    const certs = (await api<Paged<CertificateRow>>("/certificates", { query: { status: "valid", page_size: 1 } })).items;
    const id = certs[0].certificate_id;
    renderAt(`/certificates/${id}`);
    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke certificate" }));
    expect(await within(dialog).findByText(/Enter a reason/)).toBeTruthy();
    fireEvent.change(dialog.querySelector("input")!, { target: { value: "Issued in error (test)" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke certificate" }));
    await waitFor(async () => expect((await api<{ status: string }>(`/certificates/verify/${id}`, { auth: false })).status).toBe("revoked"), { timeout: 10000 });
    cleanup();
    renderAt(`/verify/${id}`);
    expect((await screen.findAllByText("CERTIFICATE REVOKED")).length).toBeGreaterThan(0);
  });
});
