import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./sms.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyActivation(db: SupabaseClient<any>, r: Record<string, unknown> | null) {
  if (!r || !r["ok"] || r["duplicate"]) return;
  await sendSms(db, {
    phone: String(r["phone"]), userId: String(r["user_id"]), trigger: "activation", dedupeKey: `activation:${r["user_id"]}`,
    message: `✅ ${r["name"]}, payment of KSh ${r["amount"]} received! You're ACTIVE. Referral link: smartearn.co.ke/ref/${r["code"]}`,
  });
  if (r["referrer_id"]) {
    await sendSms(db, {
      phone: String(r["referrer_phone"]), userId: String(r["referrer_id"]), trigger: "commission", dedupeKey: `commission:${r["user_id"]}`,
      message: `💰 ${r["referrer_name"]}, you earned KSh ${r["commission"]} from ${r["name"]}! Keep sharing → smartearn.co.ke/ref/${r["referrer_code"]}`,
    });
  }
}
