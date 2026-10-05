import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../services/api";
import { useOrganizations } from "../hooks/useDashboard";
import type { WorkerProfile } from "../types/api";
import { Button } from "./Button";
import { Field, SelectInput, TextInput } from "./Fields";
import { useToast } from "./Toast";

interface Values { name: string; worker_code: string; email: string; phone: string; organization_id: string; department: string; role_title: string; preferred_language: string; pin: string }

/** Create (no `worker`) or edit (with `worker`) a worker. Server-side validation errors are shown next to the field. */
export function WorkerForm({ worker, defaultOrgId, onDone }: { worker?: WorkerProfile; defaultOrgId?: string; onDone: (w: WorkerProfile) => void }) {
  const qc = useQueryClient(), toast = useToast(), orgs = useOrganizations(), editing = !!worker;
  const [v, setV] = useState<Values>({
    name: worker?.name ?? "", worker_code: worker?.worker_code ?? "", email: worker?.email ?? "", phone: worker?.phone ?? "",
    organization_id: worker?.organization.id ?? defaultOrgId ?? "", department: worker?.department ?? "", role_title: worker?.role_title ?? "",
    preferred_language: worker?.preferred_language ?? "en", pin: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const common = { name: v.name.trim(), email: v.email.trim() || null, phone: v.phone.trim() || null, organization_id: v.organization_id,
        department: v.department.trim() || null, role_title: v.role_title.trim() || null, preferred_language: v.preferred_language };
      return editing
        ? api<WorkerProfile>(`/workers/${worker!.id}`, { method: "PUT", body: common })
        : api<WorkerProfile>("/workers", { method: "POST", body: { ...common, worker_code: v.worker_code.trim(), pin: v.pin || null } });
    },
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["worker", w.id] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("success", editing ? "Worker updated successfully." : "Worker created successfully.");
      onDone(w);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422 && err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      else if (err instanceof ApiError && err.status === 409) setErrors({ worker_code: err.message });
      else setFormError(err instanceof ApiError ? err.message : "Unable to save the worker. Try again.");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault(); setErrors({}); setFormError(null);
    const local: Record<string, string> = {};
    if (v.name.trim().length < 2) local.name = "Enter the worker's name";
    if (!editing && !/^[A-Za-z0-9_-]{2,32}$/.test(v.worker_code.trim())) local.worker_code = "Use 2-32 letters, numbers, - or _";
    if (!v.organization_id) local.organization_id = "Select an organization";
    if (v.pin && !/^[0-9]{4,8}$/.test(v.pin)) local.pin = "PIN must be 4-8 digits";
    if (Object.keys(local).length) return setErrors(local);
    save.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {formError && <div role="alert" className="rounded-md border border-bad-600/40 bg-bad-100 p-2.5 text-sm text-bad-700">{formError}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" error={errors.name}><TextInput value={v.name} onChange={set("name")} maxLength={120} autoFocus /></Field>
        <Field label="Worker ID *" error={errors.worker_code} hint={editing ? "Worker ID cannot be changed" : "e.g. WK-016. Used to sign in on the Android app."}>
          <TextInput value={v.worker_code} onChange={set("worker_code")} disabled={editing} maxLength={32} /></Field>
        <Field label="Email" error={errors.email}><TextInput type="email" value={v.email} onChange={set("email")} /></Field>
        <Field label="Phone" error={errors.phone}><TextInput type="tel" value={v.phone} onChange={set("phone")} /></Field>
        <Field label="Organization *" error={errors.organization_id}>
          <SelectInput value={v.organization_id} onChange={set("organization_id")}><option value="">Select...</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</SelectInput></Field>
        <Field label="Preferred language" error={errors.preferred_language}>
          <SelectInput value={v.preferred_language} onChange={set("preferred_language")}><option value="en">English</option><option value="hi">Hindi</option><option value="sat">Santali</option></SelectInput></Field>
        <Field label="Department" error={errors.department}><TextInput value={v.department} onChange={set("department")} maxLength={80} /></Field>
        <Field label="Role" error={errors.role_title}><TextInput value={v.role_title} onChange={set("role_title")} maxLength={80} /></Field>
      </div>
      {!editing && <Field label="Android app PIN (optional)" error={errors.pin} hint="4-8 digits. Can be set later from the worker profile."><TextInput inputMode="numeric" autoComplete="off" value={v.pin} onChange={set("pin")} maxLength={8} /></Field>}
      <div className="flex justify-end pt-1"><Button type="submit" loading={save.isPending}>{editing ? "Save changes" : "Create worker"}</Button></div>
    </form>
  );
}
