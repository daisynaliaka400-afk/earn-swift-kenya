import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";

type Kind = "reminder" | "motivational" | "promotional" | "warning";

// Kenya time (UTC+3): 08:00 reminder, 13:00 motivational, 19:00 promotional, 22:00 warning
function kindForNow(): Kind {
  const h = (new Date().getUTCHours() + 3) % 24;
  if (h < 11) return "reminder";
  if (h < 17) return "motivational";
  if (h < 21) return "promotional";
  return "warning";
}

function authorized(request: Request) {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const secrets = [process.env["CRON_SECRET"], process.env["LOVABLE_CRON_SECRET"]].filter(Boolean);
  return !!token && secrets.includes(token);
}

async function run(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const param = url.searchParams.get("type") as Kind | null;
  const kind: Kind = param && ["reminder", "motivational", "promotional", "warning"].includes(param) ? param : kindForNow();
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { sendSms } = await import("@/lib/sms.server");
  const day = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 20 * 3600000).toISOString();

  let q = db.from("profiles").select("id,name,phone,status,last_task,balance,sms_opt_out").eq("sms_opt_out", false).limit(500);
  if (kind === "promotional") q = q.eq("status", "pending");
  else q = q.eq("status", "active");
  const { data: users } = await q;
  let sent = 0;
  for (const u of users ?? []) {
    const first = (u.name || "Member").split(" ")[0];
    const idle = !u.last_task || u.last_task < since;
    let message = "";
    if (kind === "reminder" && idle) message = `Good morning ${first}! Your 4 daily tasks are ready. Each pays from KSh 50. Start now -> ${SITE_URL}/dashboard`;
    if (kind === "motivational") message = `${first}, small steps add up. Finish today's tasks and share your link to earn more -> ${SITE_URL}/dashboard`;
    if (kind === "promotional") message = `${first}, you have used your free tasks. Activate from KSh 200 to unlock 4 paid tasks daily and withdrawals -> ${SITE_URL}/dashboard/activate`;
    if (kind === "warning" && idle) message = `${first}, you have not done any task today. Complete them before midnight so you do not miss today's earnings -> ${SITE_URL}/dashboard`;
    if (!message) continue;
    const r = await sendSms(db, { phone: u.phone, userId: u.id, trigger: `cron_${kind}`, dedupeKey: `cron_${kind}:${u.id}:${day}`, marketing: true, message });
    if (r.ok && !r.skipped) sent++;
  }
  return Response.json({ ok: true, kind, sent });
}

export const Route = createFileRoute("/api/public/cron/sms")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
