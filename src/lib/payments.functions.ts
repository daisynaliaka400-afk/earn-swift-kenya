import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone } from "./phone";

const TIER_AMOUNT = { starter: 200, standard: 350, pro: 550 } as const;

export const initiateStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tier: z.enum(["starter", "standard", "pro"]), phone: z.string().min(9).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("./sms.server");
    const phone = normalizePhone(data.phone);
    if (!phone) return { success: false as const, error: "Enter a valid Safaricom number." };

    const { data: user } = await db.from("profiles").select("*").eq("id", context.userId).single();
    if (!user) return { success: false as const, error: "Account not found." };
    if (user.status === "active") return { success: false as const, error: "Your account is already active." };
    if (user.status === "suspended") return { success: false as const, error: "Account suspended." };

    const now = Date.now();
    const { data: recent } = await db.from("stk_transactions").select("id,status,created_at,phone,user_id")
      .or(`user_id.eq.${context.userId},phone.eq.${phone}`).gte("created_at", new Date(now - 86400000).toISOString());
    const mine = (recent ?? []).filter((r) => r.user_id === context.userId);
    if (mine.some((r) => ["initiated", "pending"].includes(r.status) && now - Date.parse(r.created_at) < 120000))
      return { success: false as const, error: "A payment prompt is already in progress. Check your phone." };
    if (mine.length >= 3) return { success: false as const, error: "Daily limit of 3 payment attempts reached. Try tomorrow or use manual payment." };
    if ((recent ?? []).filter((r) => r.phone === phone && now - Date.parse(r.created_at) < 300000).length >= 3)
      return { success: false as const, error: "Too many prompts to this number. Wait 5 minutes." };

    const amount = TIER_AMOUNT[data.tier];
    const ref = `SMARTERN-${context.userId.slice(0, 8)}-${now}`;
    const payload = { phone, amount, account_reference: ref, description: "SmartEarn Activation",
      callback_url: process.env["SMARTPAY_CALLBACK_URL"] || undefined };
    await db.from("stk_transactions").insert({ user_id: context.userId, phone, amount, tier: data.tier, ref, request_payload: payload });

    const key = (process.env["SMARTPAY_API_KEY"] ?? "").trim();
    const endpoint = process.env["SMARTPAY_STK_ENDPOINT"] || "https://api.smartpaywallet.co.ke/v1/stk/push";
    let resBody: Record<string, unknown> = {};
    let okRes = false;
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payload) });
      const text = await res.text();
      try { resBody = JSON.parse(text); } catch { resBody = { raw: text }; }
      okRes = res.ok && resBody["success"] !== false;
    } catch (e) {
      resBody = { error: e instanceof Error ? e.message : String(e) };
    }
    const d = (resBody["data"] as Record<string, unknown> | undefined) ?? resBody;
    const checkout = (d["checkout_request_id"] ?? d["CheckoutRequestID"]) as string | undefined;
    const merchant = (d["merchant_request_id"] ?? d["MerchantRequestID"]) as string | undefined;

    if (!okRes) {
      const reason = String(resBody["message"] ?? resBody["error"] ?? "Gateway error");
      await db.from("stk_transactions").update({ status: "failed", failure_reason: reason, response_payload: resBody, updated_at: new Date().toISOString() }).eq("ref", ref);
      console.error("STK push failed", resBody);
      return { success: false as const, error: "Couldn't send the M-Pesa prompt. Please try again." };
    }
    await db.from("stk_transactions").update({ status: "pending", checkout_request_id: checkout ?? null, merchant_request_id: merchant ?? null, response_payload: resBody, updated_at: new Date().toISOString() }).eq("ref", ref);
    await sendSms(db, { phone, userId: context.userId, trigger: "stk_sent", dedupeKey: `stk_sent:${ref}`,
      message: `📲 ${user.name}, we've sent an M-Pesa prompt to ${phone}. Enter your PIN to activate. Ref: ${ref}` });
    return { success: true as const, ref };
  });

export const checkPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ref: z.string().min(5).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: t } = await db.from("stk_transactions").select("*").eq("ref", data.ref).eq("user_id", context.userId).single();
    if (!t) return { status: "unknown", tier: null, transaction_id: null, message: "Transaction not found." };
    if (["initiated", "pending"].includes(t.status) && Date.now() - Date.parse(t.created_at) > 300000) {
      await db.from("stk_transactions").update({ status: "failed", failure_reason: "timeout", updated_at: new Date().toISOString() }).eq("id", t.id).in("status", ["initiated", "pending"]);
      return { status: "failed", tier: t.tier, transaction_id: null, message: "The prompt expired. Please try again." };
    }
    const msg: Record<string, string> = { success: "Payment received — you're active!", failed: t.failure_reason ?? "Payment failed.", cancelled: "Payment was cancelled.", pending: "Waiting for you to enter your PIN…", initiated: "Sending prompt…" };
    return { status: t.status, tier: t.tier, transaction_id: t.transaction_id, message: msg[t.status] ?? t.status };
  });

async function assertAdmin(ctx: { supabase: { rpc: (f: "has_role", a: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminSendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(9).max(16), message: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("./sms.server");
    const r = await sendSms(db, { phone: data.phone, message: data.message, trigger: "admin_test" });
    await db.from("admin_audit").insert({ actor: context.userId, action: "sms_test", details: { phone: data.phone, status: r.status } });
    return { ...r, at: new Date().toISOString() };
  });

export const adminManualActivate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ref: z.string().min(5).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: t } = await db.from("stk_transactions").select("amount").eq("ref", data.ref).single();
    if (!t) return { ok: false, reason: "not_found" };
    const { data: r } = await db.rpc("activate_stk", { _ref: data.ref, _txid: `MANUAL-${Date.now()}`, _amount: t.amount, _payload: { manual_override: context.userId }, _actor: context.userId });
    const { notifyActivation } = await import("./activation.server");
    await notifyActivation(db, r as Record<string, unknown>);
    return r as { ok: boolean };
  });
