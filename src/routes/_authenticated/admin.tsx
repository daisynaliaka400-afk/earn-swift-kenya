import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth";
import { ksh } from "@/lib/phone";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if ((await getMyRole()) !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — SmartEarn" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const tabs = ["Overview", "Tasks", "Users"] as const;

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
  const [f, setF] = useState({ title: "", category: "Surveys", r1: "", r2: "", r3: "", mins: "3", slots: "" });
  const [err, setErr] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.from("tasks").insert({
      title: f.title, category: f.category, reward_starter: +f.r1, reward_standard: +f.r2, reward_pro: +f.r3,
      est_minutes: +f.mins || 2, slots_total: f.slots ? +f.slots : null,
    });
    if (error) return setErr(error.message);
    setF({ ...f, title: "", r1: "", r2: "", r3: "", slots: "" });
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
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {["Surveys", "Videos", "App Tasks", "Social Media", "Data Entry", "Gaming", "Shopping", "Content Creation", "Research", "Promotional"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="input" placeholder="Minutes" inputMode="numeric" value={f.mins} onChange={(e) => setF({ ...f, mins: e.target.value })} />
        <input className="input" placeholder="Starter KSh" inputMode="decimal" value={f.r1} onChange={(e) => setF({ ...f, r1: e.target.value })} required />
        <input className="input" placeholder="Standard KSh" inputMode="decimal" value={f.r2} onChange={(e) => setF({ ...f, r2: e.target.value })} required />
        <input className="input" placeholder="Pro KSh" inputMode="decimal" value={f.r3} onChange={(e) => setF({ ...f, r3: e.target.value })} required />
        <input className="input" placeholder="Slots (blank = unlimited)" inputMode="numeric" value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} />
        {err && <p className="text-sm text-destructive md:col-span-4">{err}</p>}
        <button className="btn-primary md:col-span-4">Add task</button>
      </form>
      <div className="card divide-y">
        {data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.category} · {ksh(t.reward_starter)}/{ksh(t.reward_standard)}/{ksh(t.reward_pro)} · {t.slots_used}/{t.slots_total ?? "∞"} used</p>
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
