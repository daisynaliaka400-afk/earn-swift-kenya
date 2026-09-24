import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { adminSendTestSms, adminManualActivate } from "@/lib/payments.functions";
import { ksh } from "@/lib/phone";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if ((await getMyRole()) !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [
    { title: "Admin — SmartEarn" },
    { name: "description", content: "Manage SmartEarn users, verified tasks, payments, and messages." },
    { property: "og:title", content: "Admin — SmartEarn" },
    { property: "og:description", content: "Manage SmartEarn users, verified tasks, payments, and messages." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Admin,
});

const tabs = ["Overview", "Tasks", "Users", "Payments", "SMS"] as const;

function Admin() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const nav = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="min-h-screen">
      <header className="bg-navy-gradient text-navy-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3"><Logo light /><span className="chip bg-accent/30">Admin</span></div>
          <button onClick={async () => { await supabase.auth.signOut(); qc.clear(); nav({ to: "/login" }); }} className="btn px-3 py-2 hover:bg-navy-foreground/10"><LogOut className="h-4 w-4" /></button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === t ? "border-electric" : "border-transparent opacity-60"}`}>{t}</button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "Overview" && <Overview />}
        {tab === "Tasks" && <TasksAdmin />}
        {tab === "Users" && <UsersAdmin />}
        {tab === "Payments" && <StkAdmin />}
        {tab === "SMS" && <SmsAdmin />}
      </main>
    </div>
  );
}

function Overview() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
      const [users, active, tasks, pending] = await Promise.all([
        c(supabase.from("profiles").select("*", { count: "exact", head: true })),
        c(supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active")),
        c(supabase.from("tasks").select("*", { count: "exact", head: true }).eq("is_active", true)),
        c(supabase.from("task_completions").select("*", { count: "exact", head: true }).eq("status", "pending")),
      ]);
      return { users, active, tasks, pending };
    },
  });
  const items = [["Total users", data?.users], ["Active users", data?.active], ["Live tasks", data?.tasks], ["Tasks awaiting review", data?.pending]];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k as string} className="card p-5"><p className="text-sm text-muted-foreground">{k}</p><p className="mt-1 font-display text-3xl font-bold">{v ?? "…"}</p></div>
      ))}
    </div>
  );
}

function TasksAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-tasks"], queryFn: async () => (await supabase.from("tasks").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ title: "", description: "", sponsor: "", url: "", instructions: "", category: "Surveys", r1: "", r2: "", r3: "", mins: "3", slots: "", proof: true });
  const [err, setErr] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.from("tasks").insert({
      title: f.title, description: f.description, sponsor_name: f.sponsor, action_url: f.url, instructions: f.instructions,
      category: f.category, reward_starter: +f.r1, reward_standard: +f.r2, reward_pro: +f.r3,
      est_minutes: +f.mins || 2, slots_total: f.slots ? +f.slots : null, requires_proof: f.proof, is_active: true,
    });
    if (error) return setErr(error.message);
    setF({ ...f, title: "", description: "", sponsor: "", url: "", instructions: "", r1: "", r2: "", r3: "", slots: "" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }
  async function toggle(id: string, is_active: boolean) {
    await supabase.from("tasks").update({ is_active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card grid gap-3 p-5 md:grid-cols-4">
        <input className="input md:col-span-2" placeholder="Task title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <input className="input md:col-span-2" placeholder="Sponsor or client name" value={f.sponsor} onChange={(e) => setF({ ...f, sponsor: e.target.value })} required />
        <input className="input md:col-span-4" type="url" placeholder="Verified task link (https://...)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required />
        <textarea className="input md:col-span-2" placeholder="Public task description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />
        <textarea className="input md:col-span-2" placeholder="Exact completion and proof instructions" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} required />
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {["Surveys", "Videos", "App Tasks", "Social Media", "Data Entry", "Gaming", "Shopping", "Content Creation", "Research", "Promotional"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="input" placeholder="Minutes" inputMode="numeric" value={f.mins} onChange={(e) => setF({ ...f, mins: e.target.value })} />
        <input className="input" placeholder="Starter KSh" inputMode="decimal" value={f.r1} onChange={(e) => setF({ ...f, r1: e.target.value })} required />
        <input className="input" placeholder="Standard KSh" inputMode="decimal" value={f.r2} onChange={(e) => setF({ ...f, r2: e.target.value })} required />
        <input className="input" placeholder="Pro KSh" inputMode="decimal" value={f.r3} onChange={(e) => setF({ ...f, r3: e.target.value })} required />
        <input className="input" placeholder="Slots (blank = unlimited)" inputMode="numeric" value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} />
        <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" checked={f.proof} onChange={(e) => setF({ ...f, proof: e.target.checked })} /> Require proof review before crediting</label>
        {err && <p className="text-sm text-destructive md:col-span-4">{err}</p>}
        <button className="btn-primary md:col-span-4">Add task</button>
      </form>
      <div className="card divide-y">
        {data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.title}</p>
               <p className="text-xs text-muted-foreground">{t.sponsor_name || "No sponsor"} · {t.category} · {ksh(t.reward_starter)}/{ksh(t.reward_standard)}/{ksh(t.reward_pro)} · {t.slots_used}/{t.slots_total ?? "∞"} used</p>
            </div>
            <button onClick={() => toggle(t.id, !t.is_active)} className={`chip ${t.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{t.is_active ? "Live" : "Paused"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  async function setStatus(id: string, status: "active" | "suspended" | "pending") {
    await supabase.from("profiles").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>{["Name", "Phone", "Tier", "Balance", "Status", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y">
          {data?.map((u) => (
            <tr key={u.id}>
              <td className="p-3 font-medium">{u.name}</td><td className="p-3">{u.phone}</td><td className="p-3 capitalize">{u.tier}</td>
              <td className="p-3">{ksh(u.balance)}</td><td className="p-3 capitalize">{u.status}</td>
              <td className="p-3">
                <select className="rounded-lg border bg-card px-2 py-1" value={u.status} onChange={(e) => setStatus(u.id, e.target.value as "active")}>
                  <option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SmsAdmin() {
  const send = useServerFn(adminSendTestSms);
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("SmartEarn test message.");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [res, setRes] = useState<{ status: string; httpCode: number | null; response: string; at: string } | null>(null);
  const logs = useQuery({ queryKey: ["sms-logs"], queryFn: async () => (await supabase.from("sms_logs").select("*").order("sent_at", { ascending: false }).limit(50)).data ?? [] });
  async function go(e: React.FormEvent) {
    e.preventDefault(); setState("sending"); setRes(null);
    try { setRes(await send({ data: { phone, message } })); } catch (err) { setRes({ status: "failed", httpCode: null, response: String(err), at: new Date().toISOString() }); }
    setState("idle"); qc.invalidateQueries({ queryKey: ["sms-logs"] });
  }
  return (
    <div className="space-y-6">
      <form onSubmit={go} className="card space-y-3 p-5">
        <p className="font-semibold">SMS service test</p>
        <input className="input" placeholder="07XX XXX XXX" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} required />
        <button className="btn-primary w-full" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send test SMS"}</button>
        {res && (
          <div className={`rounded-xl p-3 text-sm ${res.status === "sent" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            <p className="font-semibold capitalize">{res.status} · HTTP {res.httpCode ?? "—"} · {new Date(res.at).toLocaleString()}</p>
            <p className="mt-1 break-all font-mono text-xs">{res.response}</p>
          </div>
        )}
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr>{["Time", "Phone", "Trigger", "Status", "HTTP", "Response"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {logs.data?.map((l) => (
              <tr key={l.id}><td className="p-3 whitespace-nowrap">{new Date(l.sent_at).toLocaleString()}</td><td className="p-3">{l.phone}</td><td className="p-3">{l.trigger_type}</td>
                <td className={`p-3 font-medium ${l.status === "sent" ? "text-success" : l.status === "failed" ? "text-destructive" : ""}`}>{l.status}</td><td className="p-3">{l.http_code ?? "—"}</td>
                <td className="max-w-xs truncate p-3 font-mono" title={l.response ?? ""}>{l.response}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StkAdmin() {
  const qc = useQueryClient();
  const activate = useServerFn(adminManualActivate);
  const [status, setStatus] = useState("");
  const { data } = useQuery({ queryKey: ["stk", status], queryFn: async () => {
    let q = supabase.from("stk_transactions").select("*, profiles(name)").order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);
    return (await q).data ?? [];
  } });
  const today = new Date().toDateString();
  const t = (data ?? []).filter((x) => new Date(x.created_at).toDateString() === today);
  const ok = t.filter((x) => x.status === "success");
  function csv() {
    const rows = [["ref", "phone", "amount", "tier", "status", "transaction_id", "created_at"], ...(data ?? []).map((x) => [x.ref, x.phone, x.amount, x.tier, x.status, x.transaction_id ?? "", x.created_at])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "stk-transactions.csv" }).click();
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Pushes today", t.length], ["Success rate", t.length ? `${Math.round((ok.length / t.length) * 100)}%` : "—"], ["Revenue today", ksh(ok.reduce((a, x) => a + Number(x.amount), 0))], ["Failures today", t.filter((x) => ["failed", "cancelled"].includes(x.status)).length]].map(([k, v]) => (
          <div key={k as string} className="card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="font-display text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{["initiated", "pending", "success", "failed", "cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={csv} className="btn-outline">Export CSV</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr>{["User", "Phone", "Amount", "Tier", "Ref", "Status", "Time", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {data?.map((x) => (
              <tr key={x.id}>
                <td className="p-3">{(x.profiles as { name: string } | null)?.name}</td><td className="p-3">{x.phone}</td><td className="p-3">{ksh(x.amount)}</td><td className="p-3 capitalize">{x.tier}</td>
                <td className="p-3 font-mono">{x.ref}</td><td className="p-3">{x.status}{x.failure_reason ? ` (${x.failure_reason})` : ""}</td><td className="p-3 whitespace-nowrap">{new Date(x.created_at).toLocaleString()}</td>
                <td className="flex gap-2 p-3">
                  {x.callback_payload && <button className="text-primary" onClick={() => alert(JSON.stringify(x.callback_payload, null, 2))}>Callback</button>}
                  {x.status !== "success" && <button className="text-accent" onClick={async () => { if (confirm("Mark as paid and activate this user?")) { await activate({ data: { ref: x.ref } }); qc.invalidateQueries({ queryKey: ["stk"] }); } }}>Mark paid</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
