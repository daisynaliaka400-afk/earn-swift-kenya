import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/site/AuthShell";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import { getMyRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — SmartEarn" },
      { name: "description", content: "Log in to SmartEarn with your phone number and password." },
      { property: "og:title", content: "Log in — SmartEarn" },
      { property: "og:description", content: "Access your SmartEarn account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const p = normalizePhone(phone);
    if (!p) return setErr("Enter a valid Kenyan phone number.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: phoneToAuthEmail(p), password });
    if (error) { setBusy(false); return setErr("Incorrect phone number or password."); }
    const role = await getMyRole();
    nav({ to: role === "admin" ? "/admin" : "/dashboard" });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in with your registered phone number.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Phone number</span>
          <input className="input mt-1" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="input mt-1" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full py-3.5" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here? <Link to="/register" className="font-semibold text-primary">Create an account</Link>
      </p>
    </AuthShell>
  );
}
