import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initiateStkPush, checkPaymentStatus } from "@/lib/payments.functions";
import { ksh } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/dashboard_/activate")({
  head: () => ({ meta: [{ title: "Activate account — SmartEarn" }, { name: "robots", content: "noindex" }] }),
  component: Activate,
});

const plans = [
  { tier: "starter", name: "Starter", amount: 200, mult: "1x" },
  { tier: "standard", name: "Standard", amount: 350, mult: "2x" },
  { tier: "pro", name: "Pro", amount: 550, mult: "4x" },
] as const;

function Activate() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const push = useServerFn(initiateStkPush);
  const check = useServerFn(checkPaymentStatus);
  const { data: p } = useQuery({ queryKey: ["profile", user.id], queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).single()).data });
  const [tier, setTier] = useState<(typeof plans)[number]["tier"]>("starter");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "waiting" | "failed">("idle");
  const [msg, setMsg] = useState("");
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (p?.phone && !phone) setPhone("0" + p.phone.slice(3)); }, [p, phone]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const plan = plans.find((x) => x.tier === tier)!;

  async function pay() {
    if (state === "sending" || state === "waiting") return;
    setState("sending"); setMsg("Sending STK Push…"); setSlow(false);
    const r = await push({ data: { tier, phone } });
    if (!r.success) { setState("failed"); setMsg(r.error); return; }
    setState("waiting"); setMsg("Check your phone and enter your M-Pesa PIN.");
    const start = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - start > 120000) setSlow(true);
      const s = await check({ data: { ref: r.ref } });
      if (s.status === "success") { clearInterval(timer.current!); nav({ to: "/dashboard", search: { activated: 1 } as never }); }
      else if (["failed", "cancelled", "unknown"].includes(s.status)) { clearInterval(timer.current!); setState("failed"); setMsg(s.message); }
    }, 3000);
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <Link to="/dashboard" className="btn-ghost -ml-3 px-3 py-2"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      <h1 className="mt-4 text-2xl font-bold">Activate your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Balance {ksh(p?.balance ?? 0)}. Activation unlocks all tasks and withdrawals.</p>
      {p?.status === "active" ? (
        <div className="card mt-6 p-5 text-success">Your account is already active.</div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {plans.map((x) => (
              <button key={x.tier} onClick={() => setTier(x.tier)} className={`card flex w-full items-center justify-between p-4 text-left ${tier === x.tier ? "border-primary ring-4 ring-primary/15" : ""}`}>
                <div><p className="font-semibold">{x.name}</p><p className="text-xs text-muted-foreground">{x.mult} rewards per task</p></div>
                <p className="font-display text-lg font-bold">{ksh(x.amount)}</p>
              </button>
            ))}
          </div>
          <label className="mt-6 block"><span className="text-sm font-medium">M-Pesa number</span>
            <input className="input mt-1" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button onClick={pay} disabled={state === "sending" || state === "waiting"} className="btn-primary mt-4 w-full py-4">
            {state === "sending" || state === "waiting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            {state === "failed" ? "Retry" : "Pay"} {ksh(plan.amount)} → M-Pesa
          </button>
          {msg && <p className={`mt-3 text-center text-sm ${state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p>}
          {slow && state === "waiting" && <p className="mt-2 text-center text-sm">Did you receive the prompt? If not, wait a moment or retry.</p>}
          <div className="card mt-8 p-4 text-sm">
            <p className="font-semibold">Prompt not working?</p>
            <p className="mt-1 text-muted-foreground">Pay manually: M-Pesa → Lipa na M-Pesa → Buy Goods → Till <b>5441898</b> → amount → PIN, then send us your confirmation code via Help.</p>
          </div>
        </>
      )}
    </div>
  );
}
