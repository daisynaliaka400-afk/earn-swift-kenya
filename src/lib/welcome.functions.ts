import { SITE_URL } from "@/lib/site";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendWelcomeSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("./sms.server");
    const { data: u } = await db.from("profiles").select("name,phone,referred_by").eq("id", context.userId).single();
    if (!u) return { ok: false };
    await sendSms(db, { phone: u.phone, userId: context.userId, trigger: "welcome", dedupeKey: `welcome:${context.userId}`,
      message: `Welcome ${u.name}! You can do 3 free tasks now. Login -> ${SITE_URL}/login (use your phone number).` });
    if (u.referred_by) {
      const { data: r } = await db.from("profiles").select("id,name,phone,referral_code").eq("id", u.referred_by).single();
      if (r) await sendSms(db, { phone: r.phone, userId: r.id, trigger: "referral_registered", dedupeKey: `ref_reg:${context.userId}`, marketing: true,
        message: `${r.name}, someone just registered using your link! They'll earn you KSh 80-250 once they activate. Keep sharing -> ${SITE_URL}/register?ref=${r.referral_code}` });
    }
    return { ok: true };
  });
