# Run SmartEarn on GitHub + Vercel + your own Supabase

All backend code already reads its connection from environment variables, so
pointing it at your own Supabase needs no code changes: set the variables below.

## Backend pieces (all included)
| Piece | Where it lives |
| --- | --- |
| Tables, enums, RLS, grants | `supabase/setup.sql` |
| DB functions: `has_role`, `complete_task` (instant rewards), `activate_stk` (activation + tier + referral commission), `recent_activity`, `handle_new_user` | `supabase/setup.sql` |
| Trigger `on_auth_user_created` | `supabase/setup.sql` |
| Realtime on `tasks` | `supabase/setup.sql` |
| Payment request (SmartPay STK) | server function `src/lib/payments.functions.ts` (runs on Vercel) |
| Payment callback webhook | `src/routes/api/public/mpesa-callback.ts` -> `/api/public/mpesa-callback` |
| SMS (iSpLedger) | `src/lib/sms.server.ts` (runs on Vercel) |
| Admin actions (delete user, SMS key, manual activate) | `src/lib/payments.functions.ts` |
| Storage buckets | none used |
| Supabase Edge Functions | none - nothing to deploy |
| Cron jobs | none currently |

## 1. Supabase setup
1. Create a new project at supabase.com.
2. SQL Editor -> paste `supabase/setup.sql` -> Run.
3. Authentication -> Providers -> Email: enabled; turn OFF "Confirm email"
   (members sign in with phone numbers mapped to internal emails).
4. Authentication -> URL Configuration -> Site URL = your Vercel URL.
5. Create the admin: sign up in the app with your admin phone, then in SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from public.profiles where phone = '254713824135';
   update public.profiles set status = 'active' where phone = '254713824135';
   ```
6. Add your live tasks from the admin dashboard (each needs an https link).

## 2. Vercel environment variables
From Supabase -> Project Settings -> API:
| Name | Value |
| --- | --- |
| VITE_SUPABASE_URL | Project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | anon / publishable key |
| VITE_SUPABASE_PROJECT_ID | project ref |
| SUPABASE_URL | Project URL |
| SUPABASE_PUBLISHABLE_KEY | anon / publishable key |
| SUPABASE_SERVICE_ROLE_KEY | service_role key (server only, never VITE_) |
| SMARTPAY_API_KEY | SmartPay key |
| SMS_API_TOKEN | iSpLedger token |
| SMARTPAY_STK_ENDPOINT | optional |
| SMS_SENDER_ID | optional (default TOPSPEED) |

Redeploy after adding them.

## 3. Webhook to change
In the SmartPay dashboard set the callback URL to:
`https://YOUR-VERCEL-DOMAIN/api/public/mpesa-callback`

## Moving existing members
Existing data lives in the Lovable backend. Export tables as CSV there
(Cloud -> Advanced -> Export data) and import into the same tables in your
Supabase. Members must reset their passwords (passwords cannot be exported).
