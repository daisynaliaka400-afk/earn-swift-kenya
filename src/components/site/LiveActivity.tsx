import { useQuery } from "@tanstack/react-query";
import { UserPlus, BadgeCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { kind: string; who: string; amount: number | null; at: string };

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function LiveActivity() {
  const { data = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recent_activity");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-2">
        <span className="live-dot" />
        <p className="eyebrow">Live activity</p>
      </div>
      <h2 className="mt-2 text-2xl font-bold md:text-3xl">Members joining and getting paid</h2>
      {data.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No activity yet. New joins and payouts will show here as they happen.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r, i) => {
            const Icon = r.kind === "withdrew" ? Wallet : r.kind === "activated" ? BadgeCheck : UserPlus;
            const text =
              r.kind === "withdrew" ? `withdrew KSh ${Number(r.amount).toLocaleString()}` :
              r.kind === "activated" ? "activated their account" : "just joined";
            return (
              <li key={i} className="card flex items-center gap-3 p-4">
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{r.who}</span> {text}
                </div>
                <span className="text-xs text-muted-foreground">{ago(r.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
