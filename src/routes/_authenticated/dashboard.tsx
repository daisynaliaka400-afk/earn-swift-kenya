import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, LogOut, Wallet, Users, Flame, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth";
import { ksh } from "@/lib/phone";
import { Logo } from "@/components/site/Logo";
import { useActiveTasks } from "@/components/site/LiveTasks";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    if ((await getMyRole()) === "admin") throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [
    { title: "Dashboard — SmartEarn" },
    { name: "description", content: "Manage your SmartEarn tasks, rewards, and account activity." },
    { property: "og:title", content: "Dashboard — SmartEarn" },
    { property: "og:description", content: "Manage SmartEarn tasks, rewards, and account activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).single()).data,
  });
  const history = useQuery({
    queryKey: ["completions", user.id],
    queryFn: async () =>
      (await supabase.from("task_completions").select("id,reward,status,created_at,tasks(title)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  const tasks = useActiveTasks();
  const p = profile.data;

  async function doTask(id: string) {
    setMsg(null);
    const { data, error } = await supabase.rpc("complete_task", { _task_id: id });
    setMsg({ id, ok: !error, text: error ? error.message : `Done! ${ksh(data as number)} recorded.` });
    qc.invalidateQueries();
  }

  async function logout() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Logo />
          <button onClick={logout} className="btn-ghost px-3 py-2"><LogOut className="h-4 w-4" /> Log out</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6">
        <section className="overflow-hidden rounded-3xl bg-navy-gradient p-6 text-navy-foreground">
          <p className="text-sm opacity-70">Hi {p?.name ?? "there"} 👋</p>
          <p className="mt-3 text-xs uppercase tracking-widest opacity-60">Balance</p>
          <p className="font-display text-4xl font-bold">{ksh(p?.balance ?? 0)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`chip ${p?.status === "active" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
              {p?.status === "active" ? "Active" : p?.status === "suspended" ? "Suspended" : "Not yet activated"}
            </span>
            <span className="chip bg-navy-foreground/10 capitalize">{p?.tier} plan</span>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Flame} label="Streak" value={`${p?.streak ?? 0} days`} />
          <Stat icon={Wallet} label="Tasks done" value={String(history.data?.length ?? 0)} />
          <Stat icon={Users} label="Your code" value={p?.referral_code ?? "—"} copy />
        </div>

        {p?.status !== "active" && (
          <div className="card border-primary/30 p-5">
            <p className="font-semibold">Activate your account</p>
            <p className="mt-1 text-sm text-muted-foreground">Activation unlocks all tasks, higher rewards and withdrawals.</p>
            <Link to="/dashboard/activate" className="btn-primary mt-3 w-full">Activate with M-Pesa</Link>
          </div>
        )}

        <section>
          <h2 className="text-lg font-bold">Available tasks</h2>
          <div className="mt-3 space-y-3">
            {tasks.data?.map((t) => (
              <div key={t.id} className="card flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.title}</p>
                   {t.sponsor_name && <p className="text-xs font-medium text-primary">By {t.sponsor_name}</p>}
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><span>{t.category}</span><Clock className="h-3 w-3" />~{t.est_minutes} min</p>
                  {msg?.id === t.id && <p className={`mt-1 text-xs ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {t.action_url && <a href={t.action_url} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-2">Open <ExternalLink className="h-3.5 w-3.5" /></a>}
                  <button onClick={() => doTask(t.id)} disabled={!t.action_url || p?.status !== "active"} className="btn-primary px-3 py-2">Mark done</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold">Recent activity</h2>
          <div className="card mt-3 divide-y">
            {history.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">No tasks completed yet.</p>}
            {history.data?.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{(h.tasks as { title: string } | null)?.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{ksh(h.reward)}</p>
                  <p className={`text-xs capitalize ${h.status === "approved" ? "text-success" : h.status === "rejected" ? "text-destructive" : "text-warning"}`}>{h.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, copy }: { icon: typeof Flame; label: string; value: string; copy?: boolean }) {
  return (
    <div className="card p-3">
      <Icon className="h-4 w-4 text-accent" />
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1 truncate text-sm font-bold">
        {value}
        {copy && value !== "—" && (
          <button aria-label="Copy" onClick={() => navigator.clipboard.writeText(value)}><Copy className="h-3 w-3 text-muted-foreground" /></button>
        )}
      </p>
    </div>
  );
}
