import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/site/AuthShell";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } =>
    typeof s["ref"] === "string" ? { ref: s["ref"] } : {},
  head: () => ({
    meta: [
      { title: "Create account — SmartEarn" },
      { name: "description", content: "Create your free SmartEarn account with your phone number." },
      { property: "og:title", content: "Create account — SmartEarn" },
      { property: "og:description", content: "Join SmartEarn and start completing online tasks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function Register() {
  const nav = useNavigate();
  const { ref } = Route.useSearch();
  const [f, setF] = useState({ name: "", phone: "", password: "", ref: ref ?? "", agree: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const phone = normalizePhone(f.phone);
    if (!phone) return setErr("Enter a valid Kenyan phone number.");
    const v = schema.safeParse(f);
    if (!v.success) return setErr(v.error.issues[0]?.message ?? "Check your details.");
    if (!f.agree) return setErr("Please accept the Terms to continue.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: phoneToAuthEmail(phone),
      password: f.password,
      options: { data: { name: v.data.name, phone, ref: f.ref.trim() || null } },
    });
    setBusy(false);
    if (error) return setErr(error.message.includes("registered") ? "This phone number already has an account." : error.message);
    nav({ to: "/dashboard" });
  }

  return (
    <AuthShell title="Create your account" subtitle="Free to join. Takes under a minute.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="text-sm font-medium">Full name</span>
          <input className="input mt-1" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="block"><span className="text-sm font-medium">M-Pesa phone number</span>
          <input className="input mt-1" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
        <label className="block"><span className="text-sm font-medium">Password</span>
          <input className="input mt-1" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <label className="block"><span className="text-sm font-medium">Referral code <span className="text-muted-foreground">(optional)</span></span>
          <input className="input mt-1 uppercase" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></label>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
          <span>I agree to the <Link to="/terms" className="text-primary">Terms</Link> and <Link to="/privacy" className="text-primary">Privacy Policy</Link>.</span>
        </label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full py-3.5" disabled={busy}>{busy ? "Creating account…" : "Create Free Account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered? <Link to="/login" className="font-semibold text-primary">Log in</Link>
      </p>
    </AuthShell>
  );
}
