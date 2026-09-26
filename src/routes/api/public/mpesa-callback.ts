import { SITE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";

type Json = Record<string, unknown>;

function parse(body: Json) {
  const stk = ((body["Body"] as Json | undefined)?.["stkCallback"] as Json | undefined) ?? (body["data"] as Json | undefined) ?? body;
  const items = ((stk["CallbackMetadata"] as Json | undefined)?.["Item"] as { Name: string; Value?: unknown }[] | undefined) ?? [];
  const meta = Object.fromEntries(items.map((i) => [i.Name, i.Value]));
  return {
    checkout: (stk["CheckoutRequestID"] ?? stk["checkout_request_id"]) as string | undefined,
    ref: (stk["account_reference"] ?? stk["AccountReference"] ?? meta["AccountReference"]) as string | undefined,
    code: Number(stk["ResultCode"] ?? stk["result_code"] ?? -1),
    desc: String(stk["ResultDesc"] ?? stk["result_desc"] ?? ""),
    amount: Number(meta["Amount"] ?? stk["amount"] ?? NaN),
    txid: (meta["MpesaReceiptNumber"] ?? stk["transaction_id"] ?? stk["mpesa_receipt"]) as string | undefined,
    phone: String(meta["PhoneNumber"] ?? stk["phone"] ?? ""),
  };
}

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Json;
        try { body = (await request.json()) as Json; } catch { return Response.json({ ok: false }, { status: 400 }); }
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const p = parse(body);

        let q = db.from("stk_transactions").select("*");
        q = p.checkout ? q.eq("checkout_request_id", p.checkout) : p.ref ? q.eq("ref", p.ref) : q.eq("ref", "__none__");
        const { data: t } = await q.maybeSingle();
        if (!t) {
          console.warn("Unknown STK callback", p);
          return Response.json({ ok: false, reason: "unknown" }, { status: 200 });
        }
        if (p.ref && p.ref !== t.ref) return Response.json({ ok: false, reason: "ref_mismatch" }, { status: 200 });

        if (p.code === 0) {
          if (!p.txid) {
            await db.from("stk_transactions").update({ callback_payload: body as never, failure_reason: "missing_txid" }).eq("id", t.id);
            return Response.json({ ok: false }, { status: 200 });
          }
          const { data: r } = await db.rpc("activate_stk", { _ref: t.ref, _txid: p.txid, _amount: p.amount, _payload: body as never, _actor: "callback" });
          const { notifyActivation } = await import("@/lib/activation.server");
          await notifyActivation(db, r as Json);
          return Response.json({ ok: true });
        }

        if (t.status !== "success") {
          const cancelled = p.code === 1032;
          await db.from("stk_transactions").update({ status: cancelled ? "cancelled" : "failed", failure_reason: p.desc, callback_payload: body as never, updated_at: new Date().toISOString() }).eq("id", t.id).neq("status", "success");
          const { data: u } = await db.from("profiles").select("name").eq("id", t.user_id).single();
          const { sendSms } = await import("@/lib/sms.server");
          await sendSms(db, {
            phone: t.phone, userId: t.user_id, trigger: cancelled ? "stk_cancelled" : "stk_failed", dedupeKey: `stk_result:${t.ref}`,
            message: cancelled
              ? `${u?.name ?? "Hi"}, your M-Pesa payment was cancelled. No money was deducted. Retry -> ${SITE_URL}/dashboard/activate`
              : `${u?.name ?? "Hi"}, your payment failed: ${p.desc.slice(0, 60)}. Retry -> ${SITE_URL}/dashboard/activate`,
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
