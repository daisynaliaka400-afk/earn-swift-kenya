# Deploying SmartEarn outside Lovable

The database, login and data stay on the existing Lovable Cloud backend, so an
exported copy keeps working as long as these environment variables are set on
the host (Vercel: Project Settings > Environment Variables; Netlify: Site
configuration > Environment variables).

## Required variables

| Name | Purpose |
| --- | --- |
| VITE_SUPABASE_URL | Backend URL (copy from `.env`) |
| VITE_SUPABASE_PUBLISHABLE_KEY | Public backend key (copy from `.env`) |
| VITE_SUPABASE_PROJECT_ID | Backend project id (copy from `.env`) |
| SUPABASE_URL | Same as VITE_SUPABASE_URL |
| SUPABASE_PUBLISHABLE_KEY | Same as VITE_SUPABASE_PUBLISHABLE_KEY |
| SUPABASE_SERVICE_ROLE_KEY | Server-only admin key (needed for payment callbacks, SMS, user deletion) |
| SMARTPAY_API_KEY | SmartPay key |
| SMARTPAY_STK_ENDPOINT | Optional, SmartPay STK endpoint override |
| SMARTPAY_CALLBACK_URL | `https://YOUR-DOMAIN/api/public/mpesa-callback` |
| SMS_API_TOKEN | iSpLedger SMS token |

After deploying, register the new callback URL in the SmartPay dashboard.

## Vercel
Import the GitHub repo. `vercel.json` builds with the Vercel preset.

## Netlify
Import the GitHub repo. `netlify.toml` builds with the Netlify preset.

## Activation
When a payment callback succeeds, the account is automatically activated and
moved to the plan the member chose (Starter 200, Standard 350, Pro 550).
Tasks are credited instantly on completion.
