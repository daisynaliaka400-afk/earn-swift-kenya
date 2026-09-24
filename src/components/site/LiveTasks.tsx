import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ksh } from "@/lib/phone";

export function useActiveTasks() {
  const qc = useQueryClient();
  // Live updates: any task change instantly refreshes every open task list.
  useEffect(() => {
    const ch = supabase
      .channel(`tasks-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () =>
        qc.invalidateQueries({ queryKey: ["public-tasks"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["public-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,category,reward_starter,reward_pro,est_minutes,slots_total,slots_used,action_url,sponsor_name")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function LiveTasks() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt, error } = useActiveTasks();

  return (
    <section id="tasks" className="mx-auto max-w-6xl px-4 py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="chip bg-success/10 text-success">
            <span className="live-dot h-2 w-2 rounded-full bg-success" /> Live
          </span>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">Available tasks right now</h2>
          <p className="mt-1 text-sm text-muted-foreground">Updated automatically from the task board.</p>
        </div>
        <button onClick={() => refetch()} className="btn-outline px-3 py-2" aria-label="Refresh tasks">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {dataUpdatedAt > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Last refreshed {new Date(dataUpdatedAt).toLocaleTimeString()}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-44 animate-pulse bg-muted" />)}
        {error && <p className="text-sm text-destructive">Couldn't load tasks. Please refresh.</p>}
        {data && data.length === 0 && (
          <div className="card col-span-full p-8 text-center text-muted-foreground">No tasks are open right now. Check back soon.</div>
        )}
        {data?.map((t) => {
          const left = t.slots_total != null ? Math.max(t.slots_total - t.slots_used, 0) : null;
          const pct = t.slots_total ? (t.slots_used / t.slots_total) * 100 : 0;
          return (
            <article key={t.id} className="card flex flex-col p-5 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                 <span className="chip bg-secondary text-secondary-foreground">{t.category}</span>
                {left !== 0 && <span className="chip bg-success/10 text-success">Available now</span>}
              </div>
              <h3 className="mt-3 font-semibold">{t.title}</h3>
               {t.sponsor_name && <p className="mt-1 text-xs font-medium text-primary">By {t.sponsor_name}</p>}
              {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{t.est_minutes} min</span>
                {left != null && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {left} slots left</span>}
              </div>
              {t.slots_total && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="mt-auto flex items-center justify-between pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <p className="font-display text-lg font-bold text-brand">
                    {ksh(t.reward_starter)}{Number(t.reward_pro) > Number(t.reward_starter) && ` – ${ksh(t.reward_pro)}`}
                  </p>
                </div>
                <Link to="/register" search={{}} className="btn-primary px-4 py-2">Sign up</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
